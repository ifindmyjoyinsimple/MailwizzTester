import { Logger } from '../utils/Logger';
import {
  DEFAULT_MAIL_PASSWORD,
  MAILWIZZ_TEST_RECIPIENT_EMAIL,
  MAILWIZZ_TEST_POP_SERVER,
  MAILWIZZ_TEST_POP_PORT,
  MAILWIZZ_TEST_EMAIL_WAIT_TIME_MS,
} from '../types/constants/GlobalConstants';
import { simpleParser } from 'mailparser';
import { Delay } from '../utils/Delay';

// Types and Interfaces
// ===================

// Define Pop3Client type but use dynamic import for ESM compatibility
type Pop3Command = any;
type Pop3Client = any;

/**
 * Represents a parsed email with all its components
 */
export interface ParsedEmail {
  subject: string;
  from: string;
  to: string;
  messageId: string;
  campaignId?: string;
  htmlContent: string;
  textContent?: string;
  headers: Record<string, string>;
  date: Date;
  rawContent: string;
}

/**
 * Represents an item in the POP3 message list
 */
interface MessageListItem {
  id: number;
  size: number;
}

/**
 * EmailRetriever class handles the retrieval and parsing of emails from a POP3 server
 */
export class EmailRetriever {
  private logger: Logger;

  constructor() {
    this.logger = Logger.instance;
  }

  /**
   * Makes multiple attempts to retrieve the email, waiting between attempts
   *
   * @param campaignSubjectUuid The campaign UUID to look for in email subject lines
   * @param maxAttempts Maximum number of retrieval attempts (default: 20)
   * @param timeBetweenAttemptsMs Time to wait between attempts in ms (default: 60000 - 1 minute)
   * @returns The retrieved email result
   * @throws Error if email retrieval fails after all attempts
   */
  public async retrieveEmailWithRetries(
    campaignSubjectUuid: string,
    maxAttempts: number = 20,
    timeBetweenAttemptsMs: number = 60000
  ): Promise<ParsedEmail> {
    this.logger.info(`Starting email retrieval for campaign UUID: ${campaignSubjectUuid}`);

    let attempts = 0;
    let lastError: string | undefined;

    // Try multiple times to retrieve the email
    while (attempts < maxAttempts) {
      attempts++;
      this.logger.info(`Email retrieval attempt ${attempts}/${maxAttempts}`);

      try {
        // Retrieve the email (skip waiting on subsequent attempts)
        const retrievalResult = await this.retrieveEmailBySubjectUuid(campaignSubjectUuid);

        // If successful, return the result
        this.logger.info('Email retrieved successfully');
        return retrievalResult;
      } catch (error) {
        // Log the error if retrieval failed
        lastError = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Email retrieval attempt ${attempts} failed: ${lastError}`);
      }

      // Wait before trying again if we haven't reached max attempts
      if (attempts < maxAttempts) {
        this.logger.info(`Waiting ${timeBetweenAttemptsMs / 1000} seconds before next attempt...`);
        await Delay.wait(timeBetweenAttemptsMs);
      }
    }

    throw new Error(`Email retrieval failed after ${maxAttempts} attempts: ${lastError}`);
  }

  /**
   * Retrieves an email by searching for a UUID in the subject line
   * @param uuid - The UUID to search for in email subjects
   * @param skipWaiting - Whether to skip the default wait time for email delivery
   * @returns Promise<EmailRetrievalResult>
   */
  public async retrieveEmailBySubjectUuid(uuid: string): Promise<ParsedEmail> {
    const pop3Client = await this.createPop3Client();

    try {
      await this.connectAndAuthenticate(pop3Client);
      return await this.searchAndRetrieveEmail(pop3Client, uuid);
    } catch (error) {
      this.logger.error(`Error retrieving email: ${error}`);
      throw error;
    } finally {
      await this.closeConnection(pop3Client);
    }
  }

  /**
   * Creates a new POP3 client instance
   */
  private async createPop3Client(): Promise<Pop3Client> {
    const Pop3Command = (await import('node-pop3')).default;
    return new Pop3Command({
      user: MAILWIZZ_TEST_RECIPIENT_EMAIL,
      password: DEFAULT_MAIL_PASSWORD,
      host: MAILWIZZ_TEST_POP_SERVER,
      port: MAILWIZZ_TEST_POP_PORT,
      tls: false,
      timeout: 30000, // 30 seconds timeout
    });
  }

  /**
   * Connects to the POP3 server and authenticates
   */
  private async connectAndAuthenticate(pop3Client: Pop3Client): Promise<void> {
    this.logger.info(
      `Connecting to POP3 server: ${MAILWIZZ_TEST_POP_SERVER}:${MAILWIZZ_TEST_POP_PORT}`
    );
    await pop3Client.connect();
    await pop3Client.command('USER', MAILWIZZ_TEST_RECIPIENT_EMAIL);
    await pop3Client.command('PASS', DEFAULT_MAIL_PASSWORD);
  }

  /**
   * Safely closes the POP3 connection
   */
  private async closeConnection(pop3Client: Pop3Client): Promise<void> {
    try {
      await pop3Client.QUIT();
    } catch (error) {
      // Ignore errors during connection close
    }
  }

  /**
   * Searches through all emails to find one matching the UUID
   */
  private async searchAndRetrieveEmail(pop3Client: Pop3Client, uuid: string): Promise<ParsedEmail> {
    const messageList = await pop3Client.UIDL();
    this.logger.info(`Found ${messageList.length} messages on the server`);

    for (const [msgNum] of messageList) {
      const emailContent = await pop3Client.RETR(Number(msgNum));
      const parsedEmail = await this.parseEmailAsync(emailContent);

      if (parsedEmail && this.isEmailForSubjectUuid(parsedEmail, uuid)) {
        this.logger.info(`Found email with UUID ${uuid} in subject`);
        return parsedEmail;
      }
    }

    throw new Error(`Email with UUID ${uuid} not found`);
  }

  /**
   * Parses raw email content into a structured format
   */
  private async parseEmailAsync(rawEmail: string): Promise<ParsedEmail | null> {
    try {
      const parsed = await simpleParser(rawEmail, { maxHtmlLengthToParse: 1000000 });

      return {
        subject: parsed.subject || '',
        from: this.formatAddressObject(parsed.from) || '',
        to: this.formatAddressObject(parsed.to) || '',
        messageId: parsed.messageId || '',
        campaignId: parsed.headers.get('X-Campaign-Id')?.toString(),
        htmlContent: parsed.html?.toString() || '',
        textContent: parsed.text,
        headers: this.convertHeadersToRecord(parsed.headers),
        date: parsed.date || new Date(),
        rawContent: rawEmail,
      };
    } catch (error) {
      this.logger.error(`Error parsing email: ${error}`);
      return null;
    }
  }

  // Private Methods - Helpers
  // ======================

  /**
   * Converts email headers to a simple key-value record
   */
  private convertHeadersToRecord(headers: Map<string, string> | any): Record<string, string> {
    const result: Record<string, string> = {};

    if (headers instanceof Map) {
      for (const key of headers.keys()) {
        const value = headers.get(key);
        result[key] = value.text;
      }
    } else if (typeof headers === 'object' && headers !== null) {
      Object.keys(headers).forEach(key => {
        const value = headers[key];
        result[key] = value?.toString() || '';
      });
    }

    return result;
  }

  /**
   * Checks if an email matches the given UUID in its subject
   */
  private isEmailForSubjectUuid(email: ParsedEmail, uuid: string): boolean {
    return email.subject.includes(`[${uuid}]`);
  }

  /**
   * Formats email address objects into readable strings
   */
  private formatAddressObject(addressObj: any): string {
    if (!addressObj) return '';
    return Array.isArray(addressObj)
      ? addressObj.map(addr => this.formatSingleAddress(addr)).join(', ')
      : this.formatSingleAddress(addressObj);
  }

  /**
   * Formats a single email address into a readable string
   */
  private formatSingleAddress(address: any): string {
    if (!address) return '';
    if (address.text) return address.text;

    const name = address.name || '';
    const email = address.address || '';

    return name && email ? `${name} <${email}>` : email || name;
  }
}
