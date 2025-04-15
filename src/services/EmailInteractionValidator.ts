import { Logger } from '../utils/Logger';
import { MailwizzInteractionStatsDbConnector } from '../data/mailwizz/MailwizzInteractionStatsDbConnector';
import { Delay } from '../utils/Delay';

/**
 * Interface to represent the result of database validation for email interactions
 */
export interface EmailInteractionValidationResult {
    success: boolean;
    openRecordsExist: boolean;
    clickRecordsExist: boolean;
    unsubscribeRecordsExist: boolean;
    bounceRecordsExist: boolean;
    errors: {
        openError?: string;
        clickError?: string;
        unsubscribeError?: string;
        bounceError?: string;
    };
}

/**
 * EmailInteractionValidator class responsible for validating email interactions
 * by checking database records in the Mailwizz database
 */
export class EmailInteractionValidator {
    private logger: Logger;
    private mailwizzInteractionStatsDbConnector: MailwizzInteractionStatsDbConnector;

    // Default retry configuration for bounce validation
    private static readonly DEFAULT_BOUNCE_MAX_ATTEMPTS = 10;
    private static readonly DEFAULT_BOUNCE_RETRY_DELAY_MS = 60000; // 1 minute

    /**
     * Constructor for EmailInteractionValidator
     */
    constructor() {
        this.logger = Logger.instance;
        this.mailwizzInteractionStatsDbConnector = MailwizzInteractionStatsDbConnector.instance;
    }

    /**
     * Validates that email interactions were successfully recorded in the Mailwizz database
     * @param campaignId The Mailwizz campaign ID to validate
     * @returns The validation result if successful
     */
    public async validateInteractionRecords(
        campaignId: number
    ): Promise<void> {
        this.logger.info(`Starting mailwizz database validation for campaign ID: ${campaignId}`);

        // Validate that interactions were recorded in the Mailwizz database
        const validationResult =
            await this.validateEmailInteractionsFromMailwizz(campaignId);

        if (!validationResult || !validationResult.success) {
            const errorMessages = validationResult
                ? Object.values(validationResult.errors).filter(Boolean).join(', ')
                : 'Unknown error';
            this.logger.error(`Database validation failed: ${errorMessages}`);
            throw new Error(errorMessages);
        }
        this.logger.info('Interaction records validated successfully from mailwizz database');
    }

    /**
     * Validates that email interactions were successfully recorded in the Mailwizz database
     * @param campaignId The Mailwizz campaign ID to validate
     * @returns The result of the validation with details on each interaction type
     */
    private async validateEmailInteractionsFromMailwizz(campaignId: number): Promise<EmailInteractionValidationResult> {
        this.logger.info(`Starting email interaction validation for campaign ID: ${campaignId}`);

        const result: EmailInteractionValidationResult = {
            success: false,
            openRecordsExist: false,
            clickRecordsExist: false,
            unsubscribeRecordsExist: false,
            bounceRecordsExist: false,
            errors: {},
        };

        try {
            // Check for open tracking records
            this.logger.info('Checking for email open tracking records');
            result.openRecordsExist = await this.mailwizzInteractionStatsDbConnector.hasCampaignOpenRecords(campaignId);

            if (!result.openRecordsExist) {
                result.errors.openError = 'No email open tracking records found in database';
                this.logger.warn('No email open tracking records found in database');
            } else {
                this.logger.info('Email open tracking records found');
            }

            // Check for URL click tracking records
            this.logger.info('Checking for URL click tracking records');
            result.clickRecordsExist = await this.mailwizzInteractionStatsDbConnector.hasCampaignUrlClickRecords(campaignId);

            if (!result.clickRecordsExist) {
                result.errors.clickError = 'No URL click tracking records found in database';
                this.logger.warn('No URL click tracking records found in database');
            } else {
                this.logger.info('URL click tracking records found');
            }

            // Check for unsubscribe tracking records
            this.logger.info('Checking for unsubscribe tracking records');
            result.unsubscribeRecordsExist = await this.mailwizzInteractionStatsDbConnector.hasCampaignUnsubscribeRecords(campaignId);

            if (!result.unsubscribeRecordsExist) {
                result.errors.unsubscribeError = 'No unsubscribe tracking records found in database';
                this.logger.warn('No unsubscribe tracking records found in database');
            } else {
                this.logger.info('Unsubscribe tracking records found');
            }

            // Check for bounce records with retries
            this.logger.info('Checking for bounce records');
            const bounceResult = await this.validateBounceRecordsWithRetry(campaignId);
            result.bounceRecordsExist = bounceResult.exists;
            if (!result.bounceRecordsExist) {
                result.errors.bounceError = bounceResult.error || 'No bounce records found in database';
                this.logger.warn(result.errors.bounceError);
            } else {
                this.logger.info('Bounce records found');
            }

            // Overall success is determined by having at least three successful validations
            const successCount = [
                result.openRecordsExist,
                result.clickRecordsExist,
                result.unsubscribeRecordsExist,
                result.bounceRecordsExist,
            ].filter(success => success).length;

            result.success = successCount == 4;

            this.logger.info(`Email interaction validation ${result.success ? 'successful' : 'failed'}`);
            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error in email interaction validation: ${errorMessage}`);

            result.success = false;
            result.errors.openError = result.errors.openError || errorMessage;
            result.errors.clickError = result.errors.clickError || errorMessage;
            result.errors.unsubscribeError = result.errors.unsubscribeError || errorMessage;
            result.errors.bounceError = result.errors.bounceError || errorMessage;

            return result;
        }
    }

    /**
     * Validates bounce records with retry mechanism
     * @param campaignId The Mailwizz campaign ID to validate
     * @param maxAttempts Maximum number of attempts to check for bounce records
     * @param delayBetweenAttemptsMs Time to wait between attempts in milliseconds
     * @returns Object containing existence of bounce records and any error message
     */
    private async validateBounceRecordsWithRetry(
        campaignId: number,
        maxAttempts: number = EmailInteractionValidator.DEFAULT_BOUNCE_MAX_ATTEMPTS,
        delayBetweenAttemptsMs: number = EmailInteractionValidator.DEFAULT_BOUNCE_RETRY_DELAY_MS
    ): Promise<{ exists: boolean; error?: string }> {
        let attempts = 0;
        let lastError: string | undefined;

        while (attempts < maxAttempts) {
            attempts++;
            this.logger.info(`Bounce validation attempt ${attempts}/${maxAttempts}`);

            try {
                const bounceExists = await this.mailwizzInteractionStatsDbConnector.hasCampaignBounceRecords(campaignId);
                if (bounceExists) {
                    return { exists: true };
                }
            } catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
                this.logger.warn(`Bounce check attempt ${attempts} failed: ${lastError}`);
            }

            if (attempts < maxAttempts) {
                this.logger.info(`Waiting ${delayBetweenAttemptsMs / 1000} seconds before next bounce check attempt...`);
                await Delay.wait(delayBetweenAttemptsMs);
            }
        }

        return {
            exists: false,
            error: `No bounce records found after ${maxAttempts} attempts${lastError ? `: ${lastError}` : ''}`
        };
    }
} 