import { DbConnector } from '../../utils/DbConnector';
import { MailwizzDeliveryServerToCustomerGroup } from '../../types/db/mailwizz/MailwizzDeliveryServerToCustomerGroup';
import { Logger } from '../../utils/Logger'; // Add Logger import

export class MailwizzDeliveryServerToCustomerGroupDbConnector {
    private static _instance: MailwizzDeliveryServerToCustomerGroupDbConnector;
    private dbConnector: DbConnector;
    private logger: Logger; // Add logger instance

    private constructor() {
        this.dbConnector = DbConnector.instance;
        this.logger = Logger.instance; // Initialize logger
    }

    public static get instance(): MailwizzDeliveryServerToCustomerGroupDbConnector {
        if (!MailwizzDeliveryServerToCustomerGroupDbConnector._instance) {
            MailwizzDeliveryServerToCustomerGroupDbConnector._instance = new MailwizzDeliveryServerToCustomerGroupDbConnector();
        }
        return MailwizzDeliveryServerToCustomerGroupDbConnector._instance;
    }

    /**
     * Adds a mapping between a delivery server and a customer group if it doesn't already exist.
     * @param serverId The ID of the delivery server.
     * @param groupId The ID of the customer group.
     */
    public async addDeliveryServerToCustomerGroup(serverId: number, groupId: number): Promise<void> {
        try {
            // Check if the mapping already exists
            const checkQuery = `
        SELECT server_id FROM mailwizz.mw_delivery_server_to_customer_group
        WHERE server_id = ? AND group_id = ?
      `;
            const existingMapping = await this.dbConnector.querySingle<MailwizzDeliveryServerToCustomerGroup>(checkQuery, [serverId, groupId]);

            if (existingMapping) {
                this.logger.info(`Mapping for server_id ${serverId} and group_id ${groupId} already exists.`);
                return; // Mapping already exists, do nothing
            }

            // If mapping doesn't exist, insert it
            const insertQuery = `
        INSERT INTO mailwizz.mw_delivery_server_to_customer_group (server_id, group_id)
        VALUES (?, ?)
      `;
            await this.dbConnector.insertQuery(insertQuery, [serverId, groupId]);
            this.logger.info(`Successfully added mapping for server_id ${serverId} and group_id ${groupId}.`);

        } catch (error) {
            this.logger.error(`Error adding delivery server to customer group mapping (Server: ${serverId}, Group: ${groupId}):`, error);
            // Decide if re-throwing is necessary or if logging is sufficient
            throw error; // Uncomment if the calling process needs to handle the error
        }
    }
}