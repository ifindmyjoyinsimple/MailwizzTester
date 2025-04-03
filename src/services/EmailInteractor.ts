import { Logger } from '../utils/Logger';
import { ParsedEmail } from './EmailRetriever';
import axios from 'axios';
import { EmailLinkExtractor } from './EmailLinkExtractor';

/**
 * Interface to represent the result of email interaction simulations
 * This tracks the success/failure of each type of interaction (open, click, unsubscribe)
 * and stores the URLs that were interacted with along with any errors encountered
 */
export interface EmailInteractionResult {
  success: boolean;
  openSuccess: boolean;
  clickSuccess: boolean;
  unsubscribeSuccess: boolean;
  interactedLinks: {
    openPixelUrl?: string;
    clickedUrl?: string;
    unsubscribeUrl?: string;
  };
  errors: {
    openError?: string;
    clickError?: string;
    unsubscribeError?: string;
  };
}

/**
 * EmailInteractor class is responsible for simulating user interactions with campaign emails.
 * It handles three main types of interactions:
 * 1. Opening emails (via tracking pixel)
 * 2. Clicking links in emails
 * 3. Unsubscribe actions
 * 
 * The class follows a logical flow:
 * - Extract necessary links from email content using EmailLinkExtractor
 * - Simulate user interactions with these links
 * - Track and report success/failure of interactions
 */
export class EmailInteractor {
  private logger: Logger;
  private linkExtractor: EmailLinkExtractor;

  constructor() {
    this.logger = Logger.instance;
    this.linkExtractor = new EmailLinkExtractor();
  }

  // ===================================
  // Public Interface
  // ===================================

  /**
   * Main entry point for simulating email interactions.
   * Orchestrates the entire interaction process including opens, clicks, and unsubscribes.
   * 
   * @param email The email to use for interactions
   * @returns The interaction result if successful
   * @throws Error if the interaction simulation fails
   */
  public async startEmailInteractions(
    email: ParsedEmail
  ): Promise<void> {
    this.logger.info('Starting email interaction simulation');

    const interactionResult = await this.simulateEmailInteractions(email);

    if (!interactionResult || !interactionResult.success) {
      // If any interaction failed, log the error message and throw an error
      const errorMessage = interactionResult
        ? Object.values(interactionResult.errors).filter(Boolean).join(', ')
        : 'Unknown error';
      this.logger.error(`Email interaction simulation failed: ${errorMessage}`);

      throw new Error(errorMessage);
    }

    this.logger.info('Email interactions simulated successfully');
  }

  // ===================================
  // Core Interaction Logic
  // ===================================

  /**
   * Using try catch here because we don;t want to throw error on one failure,
   * we want to get all results and throw errors for all failures togather.
   */

  /**
   * Coordinates all email interactions in a specific sequence:
   * 1. Simulates email open via tracking pixel
   * 2. Simulates clicking a content link
   * 3. Simulates unsubscribe action
   * 
   * Success is determined by having at least 2 successful interactions.
   * 
   * @param email The parsed email to interact with
   * @returns The result of all email interactions
   */
  private async simulateEmailInteractions(email: ParsedEmail): Promise<EmailInteractionResult> {
    this.logger.info('Starting email interaction simulation');

    const result: EmailInteractionResult = {
      success: false,
      openSuccess: false,
      clickSuccess: false,
      unsubscribeSuccess: false,
      interactedLinks: {},
      errors: {},
    };

    try {
      // Step 1: Simulate email open
      await this.handleEmailOpenAndUpdateResult(email.htmlContent, result);

      // Step 2: Simulate link click
      await this.handleLinkClickAndUpdateResult(email.htmlContent, result);

      // Step 3: Simulate unsubscribe
      await this.handleUnsubscribeAndUpdateResult(email.htmlContent, result);

      // Determine overall success (at least 2 successful interactions)
      const successCount = [
        result.openSuccess,
        result.clickSuccess,
        result.unsubscribeSuccess,
      ].filter(success => success).length;

      result.success = successCount >= 2;

      this.logger.info(`Email interaction simulation ${result.success ? 'successful' : 'failed'}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in email interaction simulation: ${errorMessage}`);

      result.success = false;
      result.errors.openError = result.errors.openError || errorMessage;
      result.errors.clickError = result.errors.clickError || errorMessage;
      result.errors.unsubscribeError = result.errors.unsubscribeError || errorMessage;

      return result;
    }
  }

  // ===================================
  // Interaction Handlers
  // ===================================

  /**
   * Handles the email open interaction by finding and clicking the tracking pixel
   */
  private async handleEmailOpenAndUpdateResult(emailContent: string, result: EmailInteractionResult): Promise<void> {
    const trackingPixelUrl = this.linkExtractor.extractTrackingPixelUrl(emailContent);

    if (trackingPixelUrl) {
      this.logger.info('Found tracking pixel URL, simulating email open');
      result.interactedLinks.openPixelUrl = trackingPixelUrl;

      const openResult = await this.sendInteractionRequest(trackingPixelUrl, 'open');
      result.openSuccess = openResult.success;

      if (!openResult.success) {
        result.errors.openError = openResult.error;
      }
    } else {
      this.logger.warn('No tracking pixel URL found in email');
      result.errors.openError = 'No tracking pixel URL found';
    }
  }

  /**
   * Handles clicking a content link in the email
   */
  private async handleLinkClickAndUpdateResult(emailContent: string, result: EmailInteractionResult): Promise<void> {
    const contentLinks = this.linkExtractor.extractContentLinks(emailContent);

    if (contentLinks.length > 0) {
      const linkToClick = contentLinks[0];
      this.logger.info(`Found ${contentLinks.length} content links, simulating click on first link`);
      result.interactedLinks.clickedUrl = linkToClick;

      const clickResult = await this.sendInteractionRequest(linkToClick, 'click');
      result.clickSuccess = clickResult.success;

      if (!clickResult.success) {
        result.errors.clickError = clickResult.error;
      }
    } else {
      this.logger.warn('No content links found in email');
      result.errors.clickError = 'No content links found';
    }
  }

  /**
   * Handles the unsubscribe interaction
   */
  private async handleUnsubscribeAndUpdateResult(emailContent: string, result: EmailInteractionResult): Promise<void> {
    const unsubscribeLink = this.linkExtractor.extractUnsubscribeLink(emailContent);

    if (unsubscribeLink) {
      this.logger.info('Found unsubscribe link, simulating unsubscribe action');
      result.interactedLinks.unsubscribeUrl = unsubscribeLink;

      const unsubscribeResult = await this.sendInteractionRequest(unsubscribeLink, 'unsubscribe');
      result.unsubscribeSuccess = unsubscribeResult.success;

      if (!unsubscribeResult.success) {
        result.errors.unsubscribeError = unsubscribeResult.error;
      }
    } else {
      this.logger.warn('No unsubscribe link found in email');
      result.errors.unsubscribeError = 'No unsubscribe link found';
    }
  }

  // ===================================
  // Utility Methods
  // ===================================

  /**
   * Makes an HTTP request to simulate user interaction with a link
   * Handles redirects and sets appropriate headers to mimic browser behavior
   */
  private async sendInteractionRequest(
    url: string,
    actionType: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.info(`Simulating ${actionType} interaction with URL: ${url}`);

      const response = await axios
        .get(url, {
          timeout: 30000, // 30 second timeout
          maxRedirects: 5, // Follow up to 5 redirects
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        })
        .then(response => {
          this.logger.info(`${actionType} interaction successful (HTTP ${response.status})`);
          return { success: true };
        })
        .catch(error => {
          const errorMessage = error.response ? `HTTP ${error.response.status}` : error.message;
          this.logger.error(`${actionType} interaction failed: ${errorMessage}`);
          return { success: false, error: errorMessage };
        });
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in ${actionType} interaction: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }
}
