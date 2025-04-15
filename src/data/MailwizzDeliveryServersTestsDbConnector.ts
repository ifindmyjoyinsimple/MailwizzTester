import { DbConnector } from '../utils/DbConnector';
import { MailwizzDeliveryServersTests } from '../types/db/MailwizzDeliveryServersTests';
import { MailwizzDeliveryServersTestsStatus } from '../types/enums/MailwizzDeliveryServersTestsStatus';
import { Logger } from '../utils/Logger';

export class MailwizzDeliveryServersTestsDbConnector {
    private static _instance: MailwizzDeliveryServersTestsDbConnector;
    private dbConnector: DbConnector;
    private logger: Logger;

    private constructor() {
        this.dbConnector = DbConnector.instance;
        this.logger = Logger.instance;
    }

    public static get instance(): MailwizzDeliveryServersTestsDbConnector {
        if (!MailwizzDeliveryServersTestsDbConnector._instance) {
            MailwizzDeliveryServersTestsDbConnector._instance = new MailwizzDeliveryServersTestsDbConnector();
        }
        return MailwizzDeliveryServersTestsDbConnector._instance;
    }

    /**
     * Creates a new mailwizz delivery server test record in the database for a specific test run.
     * @param deliveryServerId The ID of the delivery server tested.
     * @param status The final status of the test (SUCCESSFUL or FAILED).
     * @param errorMessage Optional error message if the test failed.
     * @returns The ID of the newly created test record.
     */
    public async create(
        deliveryServerId: number,
        status: MailwizzDeliveryServersTestsStatus,
        errorMessage?: string
    ): Promise<number> {
        try {
            const query = `
                INSERT INTO mailwizz_delivery_servers_tests (
                    delivery_server_id,
                    status,
                    error_message
                ) VALUES (?, ?, ?)
            `;

            const result = await this.dbConnector.insertQuery(query, [
                deliveryServerId,
                status,
                errorMessage || null
            ]);

            return result.insertId;
        } catch (error) {
            this.logger.error('Failed to create mailwizz delivery server test:', error);
            throw error;
        }
    }

    /**
     * Retrieves a test record by its ID
     * @param testId The ID of the test to retrieve
     * @returns The test record or null if not found
     */
    public async getById(testId: number): Promise<MailwizzDeliveryServersTests | null> {
        try {
            const query = `
                SELECT
                    mailwizz_delivery_servers_test_id,
                    delivery_server_id,
                    status,
                    error_message,
                    test_insert_date
                FROM mailwizz_delivery_servers_tests
                WHERE mailwizz_delivery_servers_test_id = ?
            `;

            const result = await this.dbConnector.query<MailwizzDeliveryServersTests>(query, [testId]);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0] as MailwizzDeliveryServersTests;
        } catch (error) {
            this.logger.error(`Failed to get test by ID ${testId}:`, error);
            throw error;
        }
    }
} 