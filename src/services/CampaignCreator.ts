import { Logger } from '../utils/Logger';
import {
  MAILWIZZ_TEST_RECIPIENT_EMAIL,
  MAILWIZZ_TEST_CUSTOMER_ACCOUNT_ID,
} from '../types/constants/GlobalConstants';
// @ts-ignore - Fix for missing type declarations
import { v4 as uuidv4 } from 'uuid';
import { MailwizzCampaignDbConnector } from '../data/mailwizz/MailwizzCampaignDbConnector';
import { MailwizzDeliveryServer } from '../types/db/mailwizz/MailwizzDeliveryServer';

export interface CampaignCreationResult {
  campaignSubjectUuid: string;
  campaignId: number;
}
/**
 * Class responsible for creating test campaigns in Mailwizz
 * Handles database operations for campaign creation and verification
 */
export class CampaignCreator {
  private logger: Logger;
  private campaignDbConnector: MailwizzCampaignDbConnector;

  constructor() {
    this.logger = Logger.instance;
    this.campaignDbConnector = MailwizzCampaignDbConnector.instance;
  }

  /**
   * Creates a test campaign and verifies its creation
   * The sending is handled automatically by the stored procedure setting the send_at attribute
   * @param ip The IP object to use for campaign creation
   * @returns The campaign data with subject UUID and ID, or null if creation failed
   */
  public async run(mailwizzDeliveryServer: MailwizzDeliveryServer): Promise<CampaignCreationResult> {
    this.logger.info(`Starting campaign creation for Mailwizz Delivery Server: ${mailwizzDeliveryServer.server_id}`);

    // Create the campaign
    const campaignData = await this.createAndSendCampaign(mailwizzDeliveryServer);

    this.logger.info(
      `Campaign with UUID ${campaignData.campaignSubjectUuid} created successfully and will be sent automatically`
    );
    return campaignData!;
  }

  /**
   * Creates a new test campaign using the stored procedure
   * The stored procedure handles campaign creation and sets the send_at attribute
   * @param ip The IP object containing the IP address and domain information
   * @returns Object containing the campaign subject UUID and campaign ID for tracking purposes
   */
  private async createAndSendCampaign(mailwizzDeliveryServer: MailwizzDeliveryServer): Promise<CampaignCreationResult> {
    const domainName = mailwizzDeliveryServer.from_email.split('@')[1];
    const campaignSubjectUuid = uuidv4();

    this.logger.info(
      `Creating test campaign for customer account ${MAILWIZZ_TEST_CUSTOMER_ACCOUNT_ID} with recipient ${MAILWIZZ_TEST_RECIPIENT_EMAIL} using Delivery Server ${mailwizzDeliveryServer.server_id} and domain ${domainName}`
    );

    // Include the UUID in the subject for later tracking
    const emailSubject = `Test Email from ${domainName} [${campaignSubjectUuid}]`;
    const campaignName = `Test Campaign - Tester - ${domainName} - ${new Date().toISOString()}`;
    const fromName = domainName;

    // Create campaign using stored procedure via the campaign DB connector
    const campaignId = await this.campaignDbConnector.createCampaign(
      mailwizzDeliveryServer.server_id,
      emailSubject,
      campaignName,
      fromName,
      mailwizzDeliveryServer.from_email
    );

    if (!campaignId) {
      throw new Error(`Failed to create campaign for Delivery Server ${mailwizzDeliveryServer.server_id}`);
    }

    // Log the creation attempt
    this.logger.info(`Campaign creation attempted with subject UUID: ${campaignSubjectUuid}`);

    return { campaignSubjectUuid, campaignId };
  }
}
