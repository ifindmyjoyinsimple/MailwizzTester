import { MailwizzDeliveryServer } from '../types/db/mailwizz/MailwizzDeliveryServer';
import { Logger } from '../utils/Logger';
import { ParsedEmail } from './EmailRetriever';

/**
 * Interface to represent the result of email header checks
 */
export interface EmailHeaderTestResult {
    success: boolean;
    hasSender: boolean;
    hasFrom: boolean;
    hasReplyTo: boolean;
    errors: {
        senderError?: string;
        fromError?: string;
        replyToError?: string;
    };
}

/**
 * EmailHeaderTester class responsible for checking required email headers
 * Implements functionality for validating presence of required headers in campaign emails
 */
export class EmailHeaderTester {
    private logger: Logger;

    /**
     * Constructor for EmailHeaderTester
     */
    constructor() {
        this.logger = Logger.instance;
    }

    /**
   * Checks email headers for proper configuration
   *
   * @param email The email to check headers on
   * @param domainName The domain name that should appear in the headers
   * @returns The header test result if successful
   */
    public async testEmailHeaders(
        email: ParsedEmail,
        mailwizzDeliveryServer: MailwizzDeliveryServer
    ): Promise<void> {
        this.logger.info('Starting email header validation');

        // Validate the email headers
        const headerTestResult = this.validateEmailHeaders(
            email,
            mailwizzDeliveryServer
        );

        if (!headerTestResult || !headerTestResult.success) {
            const errorMessage = headerTestResult
                ? Object.values(headerTestResult.errors).filter(Boolean).join(', ')
                : 'Unknown error';
            this.logger.error(`Email header validation failed: ${errorMessage}`);
            throw new Error(errorMessage);
        }
        this.logger.info('Email headers validated successfully');
    }

    /**
     * Extracts email address from a string in format "name" <email@domain.com> or email@domain.com
     * @param headerValue String containing email information
     * @returns The extracted email address or empty string if not found
     */
    private extractEmailAddress(headerValue: string): string {
        // Log the input value for debugging
        this.logger.debug(`Extracting email from: ${headerValue}`);

        // Try to extract email from "name" <email@domain.com> format
        const emailMatch = headerValue.match(/<([^>]+)>/);
        if (emailMatch && emailMatch[1]) {
            const extractedEmail = emailMatch[1].trim();
            this.logger.debug(`Extracted email from angle brackets: ${extractedEmail}`);
            return extractedEmail;
        }

        // If no angle brackets, check if the string itself is an email
        if (headerValue.includes('@') && !headerValue.includes(' ')) {
            this.logger.debug(`Using value as email address: ${headerValue}`);
            return headerValue.trim();
        }

        this.logger.warn(`Could not extract email address from: ${headerValue}`);
        return '';
    }

    /**
     * Extracts name part from a string in format "name" <email@domain.com>
     * @param headerValue String containing email information
     * @returns The extracted name or empty string if not found
     */
    private extractName(headerValue: string): string {
        // Check if the format is "name" <email> or name <email>
        const angleBracketIndex = headerValue.indexOf('<');
        if (angleBracketIndex > 0) {
            let name = headerValue.substring(0, angleBracketIndex).trim();

            // Remove quotes if present
            if (name.startsWith('"') && name.endsWith('"')) {
                name = name.substring(1, name.length - 1);
            }

            this.logger.debug(`Extracted name: ${name}`);
            return name;
        }

        return '';
    }

    /**
     * Checks if the email has the required Sender header
     * @param email The parsed email to check
     * @param expectedEmail The expected email address
     * @returns Result of the check with success status and value/error
     */
    private checkSenderHeader(email: ParsedEmail, expectedEmail: string): { success: boolean; value?: string; error?: string } {

        // Get sender from headers
        const senderHeader = email.headers['sender'] || email.headers['Sender'];

        if (!senderHeader) {
            this.logger.warn('Sender header is missing');
            return { success: false, error: 'Sender header is missing' };
        }

        // Convert to string if needed
        const senderValue = typeof senderHeader === 'string' ? senderHeader : String(senderHeader);

        if (!senderValue) {
            this.logger.warn('Sender header is empty');
            return { success: false, error: 'Sender header is empty' };
        }

        // Extract email address if needed, or use the whole string if it's just an email
        const extractedEmail = this.extractEmailAddress(senderValue) || senderValue;

        // Case-insensitive comparison of email addresses
        if (extractedEmail.toLowerCase() !== expectedEmail.toLowerCase()) {
            this.logger.warn(`Sender header email (${extractedEmail}) does not match expected (${expectedEmail})`);
            return {
                success: false,
                value: senderValue,
                error: `Sender header email (${extractedEmail}) does not match expected (${expectedEmail})`
            };
        }

        this.logger.info(`Found valid Sender header: ${senderValue}`);
        return { success: true, value: senderValue };

    }

    /**
     * Checks if the email has the required From header
     * @param email The parsed email to check
     * @param expectedName The expected sender name
     * @param expectedEmail The expected email address
     * @returns Result of the check with success status and value/error
     */
    private checkFromHeader(email: ParsedEmail, expectedName: string, expectedEmail: string): { success: boolean; value?: string; error?: string } {

        // Get from value (handle both direct field and headers)
        const fromValue = email.from || email.headers['from'] || email.headers['From'];

        if (!fromValue) {
            this.logger.warn('From header is missing');
            return { success: false, error: 'From header is missing' };
        }

        // Convert to string if needed
        const fromString = typeof fromValue === 'string' ? fromValue : String(fromValue);

        if (!fromString) {
            this.logger.warn('From header is empty');
            return { success: false, error: 'From header is empty' };
        }

        // Extract the email address
        const extractedEmail = this.extractEmailAddress(fromString);

        if (!extractedEmail) {
            this.logger.warn(`From header doesn't contain a valid email address: ${fromString}`);
            return {
                success: false,
                value: fromString,
                error: `From header doesn't contain a valid email address: ${fromString}`
            };
        }

        // Extract the name part
        const extractedName = this.extractName(fromString);

        // Check the email part (case insensitive)
        if (extractedEmail.toLowerCase() !== expectedEmail.toLowerCase()) {
            this.logger.warn(`From header email (${extractedEmail}) does not match expected (${expectedEmail})`);
            return {
                success: false,
                value: fromString,
                error: `From header email (${extractedEmail}) does not match expected (${expectedEmail})`
            };
        }

        // Check the name part - be more flexible with domain names
        // Accept both with and without TLD (thevdfdtwo.com or just thevdfdtwo)
        const expectedNameWithoutTLD = expectedName.split('.')[0];
        if (extractedName &&
            extractedName.toLowerCase() !== expectedName.toLowerCase() &&
            extractedName.toLowerCase() !== expectedNameWithoutTLD.toLowerCase()) {

            this.logger.warn(`From header name (${extractedName}) does not match expected name (${expectedName} or ${expectedNameWithoutTLD})`);
            return {
                success: false,
                value: fromString,
                error: `From header name (${extractedName}) does not match expected name (${expectedName} or ${expectedNameWithoutTLD})`
            };
        }

        this.logger.info(`Found valid From header: ${fromString}`);
        return { success: true, value: fromString };
    }

    /**
     * Checks if the email has the required Reply-To header
     * @param email The parsed email to check
     * @param expectedName The expected sender name
     * @param expectedEmail The expected email address
     * @returns Result of the check with success status and value/error
     */
    private checkReplyToHeader(email: ParsedEmail, expectedName: string, expectedEmail: string): { success: boolean; value?: string; error?: string } {

        // Check common variations of the Reply-To header
        const replyToHeader = email.headers['reply-to'] ||
            email.headers['Reply-To'] ||
            email.headers['replyto'] ||
            email.headers['ReplyTo'];

        if (!replyToHeader) {
            this.logger.warn('Reply-To header is missing');
            return { success: false, error: 'Reply-To header is missing' };
        }

        // Convert to string if needed
        const replyToValue = typeof replyToHeader === 'string' ? replyToHeader : String(replyToHeader);

        if (!replyToValue) {
            this.logger.warn('Reply-To header is empty');
            return { success: false, error: 'Reply-To header is empty' };
        }

        // Extract the email address
        const extractedEmail = this.extractEmailAddress(replyToValue);

        if (!extractedEmail) {
            this.logger.warn(`Reply-To header doesn't contain a valid email address: ${replyToValue}`);
            return {
                success: false,
                value: replyToValue,
                error: `Reply-To header doesn't contain a valid email address: ${replyToValue}`
            };
        }

        // Extract the name part
        const extractedName = this.extractName(replyToValue);

        // Check the email part (case insensitive)
        if (extractedEmail.toLowerCase() !== expectedEmail.toLowerCase()) {
            this.logger.warn(`Reply-To header email (${extractedEmail}) does not match expected (${expectedEmail})`);
            return {
                success: false,
                value: replyToValue,
                error: `Reply-To header email (${extractedEmail}) does not match expected (${expectedEmail})`
            };
        }

        // Check the name part - be more flexible with domain names
        // Accept both with and without TLD (thevdfdtwo.com or just thevdfdtwo)
        const expectedNameWithoutTLD = expectedName.split('.')[0];
        if (extractedName &&
            extractedName.toLowerCase() !== expectedName.toLowerCase() &&
            extractedName.toLowerCase() !== expectedNameWithoutTLD.toLowerCase()) {

            this.logger.warn(`Reply-To header name (${extractedName}) does not match expected name (${expectedName} or ${expectedNameWithoutTLD})`);
            return {
                success: false,
                value: replyToValue,
                error: `Reply-To header name (${extractedName}) does not match expected name (${expectedName} or ${expectedNameWithoutTLD})`
            };
        }

        this.logger.info(`Found valid Reply-To header: ${replyToValue}`);
        return { success: true, value: replyToValue };

    }

    /**
     * Validates the required headers in an email
     * @param email The parsed email to check
     * @param domainName The domain name to use for validation
     * @returns The result of the header checks
     */
    public validateEmailHeaders(email: ParsedEmail, mailwizzDeliveryServer: MailwizzDeliveryServer): EmailHeaderTestResult {
        this.logger.info('Starting email header validation');

        const expectedEmail = mailwizzDeliveryServer.from_email;
        const expectedName = expectedEmail.split('@')[1];

        const result: EmailHeaderTestResult = {
            success: false,
            hasSender: false,
            hasFrom: false,
            hasReplyTo: false,
            errors: {},
        };

        // Check Sender header
        const senderResult = this.checkSenderHeader(email, expectedEmail);
        result.hasSender = senderResult.success;
        if (!senderResult.success) {
            result.errors.senderError = senderResult.error;
        }

        // Check From header
        const fromResult = this.checkFromHeader(email, expectedName, expectedEmail);
        result.hasFrom = fromResult.success;
        if (!fromResult.success) {
            result.errors.fromError = fromResult.error;
        }

        // Check Reply-To header
        const replyToResult = this.checkReplyToHeader(email, expectedName, expectedEmail);
        result.hasReplyTo = replyToResult.success;
        if (!replyToResult.success) {
            result.errors.replyToError = replyToResult.error;
        }

        // Overall success is determined by having all required headers with correct values
        result.success = result.hasSender && result.hasFrom && result.hasReplyTo;

        this.logger.info(`Email header validation ${result.success ? 'successful' : 'failed'}`);
        return result;
    }
} 