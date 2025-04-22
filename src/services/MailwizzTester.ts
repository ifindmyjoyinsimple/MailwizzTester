import { Logger } from '../utils/Logger';
import { CampaignCreator } from './CampaignCreator';
import { EmailRetriever, ParsedEmail } from './EmailRetriever';
import { EmailInteractor } from './EmailInteractor';
import { EmailHeaderTester } from './EmailHeaderTester';
import { EmailInteractionValidator } from './EmailInteractionValidator';
import { MailwizzDatabasePreparator } from './MailwizzDatabasePreparator';
import { MailwizzDeliveryServer } from '../types/db/mailwizz/MailwizzDeliveryServer';
import { MailwizzDeliveryServerDbConnector } from '../data/mailwizz/MailwizzDeliveryServerDbConnector';
import { MailwizzDeliveryServersTestsDbConnector } from '../data/MailwizzDeliveryServersTestsDbConnector';
import { MailwizzDeliveryServersTestsStatus } from '../types/enums/MailwizzDeliveryServersTestsStatus';
import { MailwizzDeliveryServerToCustomerGroupDbConnector } from '../data/mailwizz/MailwizzDeliveryServerToCustomerGroupDbConnector';
import { MAILWIZZ_DEFAULT_CUSTOMER_GROUP_ID } from '../types/constants/GlobalConstants';
import { MailboxEmailLinksClickerEmailsDbConnector } from '../data/MailboxEmailLinksClickerEmailsDbConnector';
import { MailboxEmailLinksClickerEmail } from 'src/types/db/MailboxEmailLinksClickerEmail';
/**
 * MailwizzTester - Orchestrates email delivery testing
 *
 * This class coordinates the complete testing workflow:
 * 1. Finds all valid domains on a server
 * 2. Tests each domain individually using DomainTester
 * 3. Collects and reports results
 */
export class MailwizzTester {
  private logger: Logger;
  private mailwizzDeliveryServerDbConnector: MailwizzDeliveryServerDbConnector;
  private mailwizzDeliveryServersTestsDbConnector: MailwizzDeliveryServersTestsDbConnector;
  private mailwizzDeliveryServerToCustomerGroupDbConnector: MailwizzDeliveryServerToCustomerGroupDbConnector;
  private mailboxEmailLinksClickerEmailsDbConnector: MailboxEmailLinksClickerEmailsDbConnector;
  /**
   * Initializes the MailwizzTester
   */
  constructor() {
    this.logger = Logger.instance;
    this.mailwizzDeliveryServerDbConnector = MailwizzDeliveryServerDbConnector.instance;
    this.mailwizzDeliveryServersTestsDbConnector = MailwizzDeliveryServersTestsDbConnector.instance;
    this.mailwizzDeliveryServerToCustomerGroupDbConnector = MailwizzDeliveryServerToCustomerGroupDbConnector.instance;
    this.mailboxEmailLinksClickerEmailsDbConnector = MailboxEmailLinksClickerEmailsDbConnector.instance;
  }


  /**
   * Run all test steps for a single domain
   *
   * @param ip The IP object with its associated domain to test
   * @returns True if all test steps passed, false if any failed
   */
  public async runForDeliveryServer(mailwizzDeliveryServerId: number): Promise<void> {

    try {
      const mailwizzDeliveryServer = await this.getDeliveryServer(mailwizzDeliveryServerId);

      this.logger.info(`Starting test for Delivery Server: ${mailwizzDeliveryServer!.server_id}`);

      // Step 1: Prepare the Mailwizz database
      await new MailwizzDatabasePreparator().run(mailwizzDeliveryServer!);

      // Step 2: Create a campaign
      const campaignData = await new CampaignCreator().run(mailwizzDeliveryServer!);


      // Step 3: Retrieve the email
      const email = await this.getEmailWithRetries(campaignData.campaignSubjectUuid);

      if (!email) {
        this.logger.error(`Email not found for subject uuid: ${campaignData.campaignSubjectUuid}`);
        throw new Error(`Email not found for subject uuid: ${campaignData.campaignSubjectUuid}`);
      }

      // Step 5: Validate that interactions were recorded in the database
      await new EmailInteractionValidator().validateInteractionRecords(campaignData.campaignId);

      // Step 6: Check email headers for proper configuration
      await new EmailHeaderTester().testEmailHeaders(email, mailwizzDeliveryServer!);

      // Step 7: Create a record for the successful delivery server test
      await this.mailwizzDeliveryServersTestsDbConnector.create(mailwizzDeliveryServerId, MailwizzDeliveryServersTestsStatus.SUCCESSFUL);

      // Step 8: Add delivery server to the default customer group
      this.logger.info(`Attempting to add server ${mailwizzDeliveryServerId} to group ${MAILWIZZ_DEFAULT_CUSTOMER_GROUP_ID}`);
      await this.mailwizzDeliveryServerToCustomerGroupDbConnector.addDeliveryServerToCustomerGroup(
        mailwizzDeliveryServerId,
        MAILWIZZ_DEFAULT_CUSTOMER_GROUP_ID
      );

      this.logger.info(`Test for Delivery Server ${mailwizzDeliveryServer!.server_id} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error running test for Delivery Server ${mailwizzDeliveryServerId}: ${errorMessage}`);
      // Create a record for the failed delivery server test
      await this.mailwizzDeliveryServersTestsDbConnector.create(mailwizzDeliveryServerId, MailwizzDeliveryServersTestsStatus.FAILED, errorMessage);

      // Update the delivery server status to inactive
      try {
        this.logger.warn(`Setting status to inactive for Delivery Server ${mailwizzDeliveryServerId} due to test failure.`);
        await this.mailwizzDeliveryServerDbConnector.updateDeliveryServerStatus(mailwizzDeliveryServerId, 'inactive');
      } catch (updateError) {
        this.logger.error(`Failed to update status for Delivery Server ${mailwizzDeliveryServerId}:`, updateError);
        // Log the update error, but still throw the original test error
      }

      throw error;
    }
  }

  private async getDeliveryServer(mailwizzDeliveryServerId: number): Promise<MailwizzDeliveryServer | null> {
    const deliveryServer = await this.mailwizzDeliveryServerDbConnector.getDeliveryServerById(mailwizzDeliveryServerId);
    if (!deliveryServer) {
      throw new Error(`Delivery server with ID ${mailwizzDeliveryServerId} not found`);
    }
    return deliveryServer;
  }

  private async getEmailWithRetries(subjectUuid: string): Promise<MailboxEmailLinksClickerEmail> {
    const maxRetries = 10;
    const retryDelay = 60000; // 1 minute

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const email = await this.mailboxEmailLinksClickerEmailsDbConnector.getEmailBySubjectUuid(subjectUuid);
        if (!email) {
          throw new Error(`Email not found for subject uuid: ${subjectUuid}`);
        }
        return email;
      } catch (error) {
        if (attempt < maxRetries - 1) {
          this.logger.warn(`Email not found for subject uuid: ${subjectUuid}, retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          this.logger.error(`Email not found for subject uuid: ${subjectUuid}, after ${maxRetries} attempts`);
          throw error;
        }
      }
    }
    throw new Error(`Email not found for subject uuid: ${subjectUuid}, after ${maxRetries} attempts`);
  }
}
