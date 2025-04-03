import { DbConnector } from '../../utils/DbConnector';

/**
 * Connector class for retrieving email interaction statistics from Mailwizz database
 * Used to validate if email interactions like opens, clicks, bounces and unsubscribes
 * were recorded properly in the Mailwizz database
 */
export class MailwizzInteractionStatsDbConnector {
    private static _instance: MailwizzInteractionStatsDbConnector;
    private dbConnector: DbConnector;

    private constructor() {
        this.dbConnector = DbConnector.instance;
    }

    public static get instance(): MailwizzInteractionStatsDbConnector {
        if (!MailwizzInteractionStatsDbConnector._instance) {
            MailwizzInteractionStatsDbConnector._instance = new MailwizzInteractionStatsDbConnector();
        }
        return MailwizzInteractionStatsDbConnector._instance;
    }

    /**
     * Checks if there is at least one bounce record for the given campaign
     * @param campaignId The Mailwizz campaign ID to check
     * @returns True if at least one bounce record exists, false otherwise
     */
    public async hasCampaignBounceRecords(campaignId: number): Promise<boolean> {
        try {
            const query = `
        SELECT COUNT(*) as count
        FROM mailwizz.mw_campaign_bounce_log
        WHERE campaign_id = ?
      `;

            const result = await this.dbConnector.query(query, [campaignId]);
            const resultRows = result.rows as { count: number }[];
            return resultRows[0].count > 0;
        } catch (error) {
            console.error('Error checking campaign bounce records:', error);
            return false;
        }
    }

    /**
     * Checks if there is at least one open tracking record for the given campaign
     * @param campaignId The Mailwizz campaign ID to check
     * @returns True if at least one open tracking record exists, false otherwise
     */
    public async hasCampaignOpenRecords(campaignId: number): Promise<boolean> {
        try {
            const query = `
        SELECT COUNT(*) as count
        FROM mailwizz.mw_campaign_track_open
        WHERE campaign_id = ?
      `;

            const result = await this.dbConnector.query(query, [campaignId]);
            const resultRows = result.rows as { count: number }[];
            return resultRows[0].count > 0;
        } catch (error) {
            console.error('Error checking campaign open records:', error);
            return false;
        }
    }

    /**
     * Checks if there is at least one unsubscribe tracking record for the given campaign
     * @param campaignId The Mailwizz campaign ID to check
     * @returns True if at least one unsubscribe tracking record exists, false otherwise
     */
    public async hasCampaignUnsubscribeRecords(campaignId: number): Promise<boolean> {
        try {
            const query = `
        SELECT COUNT(*) as count
        FROM mailwizz.mw_campaign_track_unsubscribe
        WHERE campaign_id = ?
      `;

            const result = await this.dbConnector.query(query, [campaignId]);
            const resultRows = result.rows as { count: number }[];
            return resultRows[0].count > 0;
        } catch (error) {
            console.error('Error checking campaign unsubscribe records:', error);
            return false;
        }
    }

    /**
     * Checks if there is at least one URL click tracking record for the given campaign
     * Uses a subquery to find URLs associated with the campaign
     * @param campaignId The Mailwizz campaign ID to check
     * @returns True if at least one URL click tracking record exists, false otherwise
     */
    public async hasCampaignUrlClickRecords(campaignId: number): Promise<boolean> {
        try {
            const query = `
        SELECT COUNT(*) as count
        FROM mailwizz.mw_campaign_track_url
        WHERE url_id IN (
          SELECT url_id
          FROM mailwizz.mw_campaign_url
          WHERE campaign_id = ?
        )
      `;

            const result = await this.dbConnector.query(query, [campaignId]);
            const resultRows = result.rows as { count: number }[];
            return resultRows[0].count > 0;
        } catch (error) {
            console.error('Error checking campaign URL click records:', error);
            return false;
        }
    }
} 