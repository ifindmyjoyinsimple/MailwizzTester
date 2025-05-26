import { MailwizzDeliveryServerDbConnector } from '../data/mailwizz/MailwizzDeliveryServerDbConnector';
// MailwizzDeliveryServersTestsDbConnector is no longer needed for the core logic here
// import { MailwizzDeliveryServersTestsDbConnector } from '../data/MailwizzDeliveryServersTestsDbConnector';
import { MailwizzTester } from './MailwizzTester';
import { Logger } from '../utils/Logger';
import { MailwizzDeliveryServer } from '../types/db/mailwizz/MailwizzDeliveryServer';
// MailwizzDeliveryServersTests is no longer needed here
// import { MailwizzDeliveryServersTests } from '../types/db/MailwizzDeliveryServersTests';

/**
 * AutoRunnerService - Orchestrates the automated testing of Mailwizz delivery servers.
 *
 * Fetches active servers updated within the last hour and triggers tests
 * for them using MailwizzTester.
 */
export class AutoRunnerService {
    private logger: Logger;
    private deliveryServerDb: MailwizzDeliveryServerDbConnector;
    // private testDb: MailwizzDeliveryServersTestsDbConnector; // No longer needed
    private tester: MailwizzTester;

    constructor() {
        this.logger = Logger.instance;
        this.deliveryServerDb = MailwizzDeliveryServerDbConnector.instance;
        // this.testDb = MailwizzDeliveryServersTestsDbConnector.instance; // No longer needed
        this.tester = new MailwizzTester();
    }

    /**
     * Runs the automated test cycle for active Mailwizz delivery servers.
     */
    public async runAutoTestCycle(): Promise<void> {
        this.logger.info('Starting auto-run test cycle...');

        // Time calculation is now handled within the SQL query
        let serversUpdatedInLastHour: MailwizzDeliveryServer[] = [];
        let serversNotTestedInLast24Hours: MailwizzDeliveryServer[] = [];
        try {
            // Fetch active servers updated in the last hour (DB handles time calculation)
            serversUpdatedInLastHour = await this.deliveryServerDb.getActiveServersUpdatedInLastHour();
            this.logger.info(`Found ${serversUpdatedInLastHour.length} active servers updated within the last hour to test.`);
        } catch (error) {
            this.logger.error('Failed to fetch servers updated in the last hour needing tests:', error);
        }

        try {
            // GET active servers that have not been tested in the last 24 hours
            serversNotTestedInLast24Hours = await this.deliveryServerDb.getActiveServersNotTestedInLast24Hours();
            this.logger.info(`Found ${serversNotTestedInLast24Hours.length} active servers not tested in the last 24 hours to test.`);
        } catch (error) {
            this.logger.error('Failed to fetch servers not tested in the last 24 hours needing tests:', error);
        }

        // Combine the two arrays
        const serversToTest = [...serversUpdatedInLastHour, ...serversNotTestedInLast24Hours];

        if (serversToTest.length === 0) {
            this.logger.info('No servers require testing in this cycle.');
            this.logger.info('Auto-run test cycle finished.');
            return;
        }

        for (const server of serversToTest) {
            this.logger.info(`Initiating test for server ID: ${server.server_id}, Name: ${server.name}`);
            try {
                // MailwizzTester's runForDeliveryServer handles its own success/failure logging
                // and updates server status on failure.
                await this.tester.runForDeliveryServer(server.server_id);
                this.logger.info(`Test completed for server ${server.server_id}. Check MailwizzTester logs for outcome.`);
            } catch (error) {
                // Error is logged within MailwizzTester and status is updated there.
                // Log here just to indicate the cycle encountered a test failure for this server.
                this.logger.error(`Test failed during execution for server ${server.server_id}. See previous logs for details.`);
                // Continue to the next server even if one fails
            }
        }

        this.logger.info('Auto-run test cycle finished.');
    }
}