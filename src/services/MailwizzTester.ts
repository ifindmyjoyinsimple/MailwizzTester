import { Logger } from '../utils/Logger';
import { CampaignCreator } from './CampaignCreator';
import { EmailRetriever } from './EmailRetriever';
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
  /**
   * Initializes the MailwizzTester
   */
  constructor() {
    this.logger = Logger.instance;
    this.mailwizzDeliveryServerDbConnector = MailwizzDeliveryServerDbConnector.instance;
    this.mailwizzDeliveryServersTestsDbConnector = MailwizzDeliveryServersTestsDbConnector.instance;
    this.mailwizzDeliveryServerToCustomerGroupDbConnector = MailwizzDeliveryServerToCustomerGroupDbConnector.instance;
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
      const emailResult = await new EmailRetriever().retrieveEmailWithRetries(
        campaignData.campaignSubjectUuid
      );

      // Step 4: Simulate interactions with the email
      await new EmailInteractor().startEmailInteractions(emailResult);

      // Step 5: Validate that interactions were recorded in the database
      await new EmailInteractionValidator().validateInteractionRecords(campaignData.campaignId);

      // Step 6: Check email headers for proper configuration
      await new EmailHeaderTester().testEmailHeaders(emailResult, mailwizzDeliveryServer!);

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
}
