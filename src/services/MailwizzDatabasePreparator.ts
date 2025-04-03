import { Logger } from '../utils/Logger';
import { MailwizzListSubscriberDbConnector } from '../data/mailwizz/MailwizzListSubscriberDbConnector';
import { MailwizzDeliveryServerDbConnector } from '../data/mailwizz/MailwizzDeliveryServerDbConnector';
import { MailwizzDeliveryServer } from '../types/db/mailwizz/MailwizzDeliveryServer';

/**
 * MailwizzDatabasePreparator - Prepares the Mailwizz database for testing
 * 
 * This class performs necessary database adjustments as prerequisites for the MailwizzTester.
 * It ensures that all required database entities are in the correct state before testing begins.
 */
export class MailwizzDatabasePreparator {
    private logger: Logger;
    private listSubscriberDbConnector: MailwizzListSubscriberDbConnector;
    private deliveryServerDbConnector: MailwizzDeliveryServerDbConnector;

    /**
     * Initializes the MailwizzDatabasePreparator with necessary database connectors
     */
    constructor() {
        this.logger = Logger.instance;
        this.listSubscriberDbConnector = MailwizzListSubscriberDbConnector.instance;
        this.deliveryServerDbConnector = MailwizzDeliveryServerDbConnector.instance;
    }

    public async run(mailwizzDeliveryServer: MailwizzDeliveryServer): Promise<void> {
        this.logger.info(`Starting database preparation for Mailwizz Delivery Server: ${mailwizzDeliveryServer.server_id}`);

        // Ensure test emails are not blacklisted and are confirmed
        await this.listSubscriberDbConnector.deleteTestBounceEmailFromBlacklist();
        await this.listSubscriberDbConnector.updateTestEmailsSubscriptionStatusToConfirmed();

        // Set the delivery server quota to unlimited
        await this.deliveryServerDbConnector.setDeliveryServerUnlimitedQuotaById(mailwizzDeliveryServer.server_id);
    }
} 