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
     * Creates a new mailwizz delivery server test record in the database
     * @param deliveryServerId The ID of the delivery server to test
     * @returns The ID of the newly created test record
     */
    public async create(deliveryServerId: number): Promise<number> {
        try {
            const query = `
                INSERT INTO mailwizz_delivery_servers_tests (
                    delivery_server_id,
                    test_insert_date,
                    status
                ) VALUES (?, NOW(), ?)
            `;

            const result = await this.dbConnector.insertQuery(query, [
                deliveryServerId,
                MailwizzDeliveryServersTestsStatus.PENDING
            ]);

            return result.insertId;
        } catch (error) {
            this.logger.error('Failed to create mailwizz delivery server test:', error);
            throw error;
        }
    }

    /**
     * Updates the test status and error message in the database using IFNULL
     * @param testId The ID of the test to update
     * @param status The new status for the test (optional)
     * @param errorMessage The error message to save (optional)
     * @returns A boolean indicating whether the update was successful
     */
    public async update(
        testId: number,
        status?: MailwizzDeliveryServersTestsStatus,
        errorMessage?: string
    ): Promise<boolean> {
        try {
            const query = `
                UPDATE mailwizz_delivery_servers_tests 
                SET status = IFNULL(?, status),
                    error_message = IFNULL(?, error_message),
                    date_last_tested = CASE 
                        WHEN ? IS NOT NULL THEN NOW()
                        ELSE date_last_tested
                    END
                WHERE mailwizz_delivery_servers_test_id = ?
            `;

            await this.dbConnector.query(query, [
                status || null,
                errorMessage || null,
                status || null,
                testId
            ]);

            return true;
        } catch (error) {
            this.logger.error(`Failed to update test status for test ID ${testId}:`, error);
            throw error;
        }
    }

    /**
     * Creates a new test record or updates an existing one for a delivery server
     * @param deliveryServerId The ID of the delivery server to test
     * @param status The status to set for the test
     * @param errorMessage Optional error message to save
     * @returns The ID of the test record (either newly created or updated)
     */
    public async upsert(
        deliveryServerId: number,
        status: MailwizzDeliveryServersTestsStatus,
        errorMessage?: string
    ): Promise<number> {
        try {
            // First try to find an existing record
            const existingQuery = `
                SELECT mailwizz_delivery_servers_test_id 
                FROM mailwizz_delivery_servers_tests 
                WHERE delivery_server_id = ?
            `;

            const existingResult = await this.dbConnector.query<{ mailwizz_delivery_servers_test_id: number }>(existingQuery, [deliveryServerId]);

            if (existingResult.rows.length > 0) {
                // Update existing record
                await this.update(
                    existingResult.rows[0].mailwizz_delivery_servers_test_id,
                    status,
                    errorMessage
                );
                return existingResult.rows[0].mailwizz_delivery_servers_test_id;
            }

            // Create new record
            const insertQuery = `
                INSERT INTO mailwizz_delivery_servers_tests (
                    delivery_server_id,
                    test_insert_date,
                    status,
                    error_message,
                    date_last_tested
                ) VALUES (?, NOW(), ?, ?, NOW())
            `;

            const insertResult = await this.dbConnector.insertQuery(insertQuery, [
                deliveryServerId,
                status,
                errorMessage || null
            ]);

            return insertResult.insertId;
        } catch (error) {
            this.logger.error('Failed to upsert mailwizz delivery server test:', error);
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
                SELECT * FROM mailwizz_delivery_servers_tests 
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