import { DbConnector } from '../../utils/DbConnector';
import { Logger } from '../../utils/Logger';
import {
  MAILWIZZ_TEST_CUSTOMER_ACCOUNT_ID,
  MAILWIZZ_TEST_LIST_ID,
  MAILWIZZ_TEST_TEMPLATE_ID,
} from '../../types/constants/GlobalConstants';

/**
 * Class responsible for database operations related to Mailwizz campaigns
 * Provides methods to create and interact with campaigns in the database
 */
export class MailwizzCampaignDbConnector {
  private static _instance: MailwizzCampaignDbConnector;
  private dbConnector: DbConnector;
  private logger: Logger;

  /**
   * Private constructor to enforce singleton pattern
   * Initializes database connection and logger
   */
  private constructor() {
    this.dbConnector = DbConnector.instance;
    this.logger = Logger.instance;
  }

  /**
   * Gets the singleton instance of MailwizzCampaignDbConnector
   * Creates the instance if it doesn't exist yet
   */
  public static get instance(): MailwizzCampaignDbConnector {
    if (!MailwizzCampaignDbConnector._instance) {
      MailwizzCampaignDbConnector._instance = new MailwizzCampaignDbConnector();
    }
    return MailwizzCampaignDbConnector._instance;
  }

  /**
   * Creates a new campaign using the stored procedure
   * @param domainName Domain name to use in the campaign
   * @param campaignSubjectUuid UUID to include in the subject for tracking
   * @param deliveryServerId The ID of the delivery server to use
   * @param emailSubject The subject line for the email
   * @param campaignName The name of the campaign
   * @param fromName The sender name
   * @param fromEmail The sender email address
   * @returns The campaign ID or null if creation failed
   */
  public async createCampaign(
    deliveryServerId: number,
    emailSubject: string,
    campaignName: string,
    fromName: string,
    fromEmail: string
  ): Promise<number> {
    // Execute the stored procedure to create a campaign in the marketing_automation database
    const query = 'CALL marketing_automation.campaign_create_new(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

    // Based on the stored procedure definition, we need to pass all required parameters
    const params = [
      MAILWIZZ_TEST_LIST_ID, // p_list_id
      MAILWIZZ_TEST_CUSTOMER_ACCOUNT_ID, // p_customer_id
      campaignName, // p_campaign_name
      MAILWIZZ_TEST_TEMPLATE_ID, // p_template_id
      null, // p_send_at
      fromName, // p_from_name
      fromEmail, // p_from_email
      deliveryServerId, // p_delivery_server_id
      emailSubject, // p_email_subject with UUID for tracking
      'Test pre-header', // p_pre_header
      null // p_status
    ];

    // Execute the query and parse the result
    this.logger.info(
      `Creating campaign "${campaignName}" for delivery server ID ${deliveryServerId}`
    );
    const result = await this.dbConnector.query<[{ campaign_id: number }]>(query, params);

    // Extract the campaign ID from the result
    const campaignId = result.rows[0][0].campaign_id;
    if (!campaignId) {
      throw new Error('Campaign creation stored procedure did not return a campaign ID');
    }

    this.logger.info(`Campaign created with ID: ${campaignId}`);
    return campaignId;
  }
}
