import { MailwizzDeliveryServerDbConnector } from '../data/mailwizz/MailwizzDeliveryServerDbConnector';
import { MailwizzDeliveryServersTestsDbConnector } from '../data/MailwizzDeliveryServersTestsDbConnector';
import { MailwizzTester } from './MailwizzTester';
import { Logger } from '../utils/Logger';
import { MailwizzDeliveryServer } from '../types/db/mailwizz/MailwizzDeliveryServer';
import { MailwizzDeliveryServersTests } from '../types/db/MailwizzDeliveryServersTests';

/**
 * AutoRunnerService - Orchestrates the automated testing of Mailwizz delivery servers.
 *
 * Fetches active servers, checks if they need testing based on their last update
 * time and the last test run time, and triggers tests using MailwizzTester.
 */
export class AutoRunnerService {
    private logger: Logger;
    private deliveryServerDb: MailwizzDeliveryServerDbConnector;
    private testDb: MailwizzDeliveryServersTestsDbConnector;
    private tester: MailwizzTester; // Assuming MailwizzTester is designed as a singleton or has a static instance

    constructor() {
        this.logger = Logger.instance;
        this.deliveryServerDb = MailwizzDeliveryServerDbConnector.instance;
        this.testDb = MailwizzDeliveryServersTestsDbConnector.instance;
        // Assuming MailwizzTester can be instantiated directly or has a static instance method
        // If MailwizzTester requires dependencies in its constructor, adjust instantiation accordingly.
        this.tester = new MailwizzTester();
    }

    /**
     * Runs the automated test cycle for active Mailwizz delivery servers.
     */
    public async runAutoTestCycle(): Promise<void> {
        this.logger.info('Starting auto-run test cycle...');

        let activeServers: MailwizzDeliveryServer[];
        try {
            activeServers = await this.deliveryServerDb.getDeliveryServersByStatus('active');
            this.logger.info(`Found ${activeServers.length} active delivery servers.`);
        } catch (error) {
            this.logger.error('Failed to fetch active delivery servers:', error);
            return; // Cannot proceed without the server list
        }

        for (const server of activeServers) {
            this.logger.info(`Processing server ID: ${server.server_id}, Name: ${server.name}`);
            let latestTest: MailwizzDeliveryServersTests | null = null;
            try {
                latestTest = await this.testDb.getLatestTestForServer(server.server_id);
            } catch (error) {
                this.logger.error(`Failed to fetch latest test for server ${server.server_id}:`, error);
                continue; // Skip this server if we can't get its test status
            }

            let needsTest = false;
            if (!latestTest) {
                this.logger.info(`No previous test found for server ${server.server_id}. Test required.`);
                needsTest = true;
            } else if (latestTest.test_insert_date < server.last_updated) {
                this.logger.info(`Server ${server.server_id} was updated (${server.last_updated}) after the last test (${latestTest.test_insert_date}). Test required.`);
                needsTest = true;
            } else {
                this.logger.info(`Server ${server.server_id} does not require a new test.`);
            }

            if (needsTest) {
                this.logger.info(`Initiating test for server ${server.server_id}...`);
                try {
                    // MailwizzTester's runForDeliveryServer handles its own success/failure logging
                    // and updates server status on failure.
                    await this.tester.runForDeliveryServer(server.server_id);
                    this.logger.info(`Test completed for server ${server.server_id}. Check MailwizzTester logs for outcome.`);
                } catch (error) {
                    // Error is logged within MailwizzTester and status is updated there.
                    // Log here just to indicate the cycle encountered a test failure.
                    this.logger.error(`Test failed for server ${server.server_id}. See previous logs for details.`);
                    // Continue to the next server
                }
            }
        }

        this.logger.info('Auto-run test cycle finished.');
    }
}