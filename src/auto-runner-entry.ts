import { AutoRunnerService } from './services/AutoRunnerService';
import { Logger } from './utils/Logger';
import { DbConnector } from './utils/DbConnector'; // Import DbConnector if explicit shutdown is needed

/**
 * Entry point for the automated Mailwizz delivery server testing process.
 *
 * This script instantiates the AutoRunnerService and triggers the test cycle.
 * It should be executed by a scheduler (e.g., cron, AWS Lambda scheduled event).
 */
async function run() {
    const logger = Logger.instance; // Initialize logger early
    logger.info('Starting Auto Runner Entry Point...');

    // Optional: Add any environment variable loading or initial setup here if needed

    const autoRunner = new AutoRunnerService();

    try {
        await autoRunner.runAutoTestCycle();
        logger.info('Auto Runner Entry Point finished successfully.');
    } catch (error) {
        logger.error('Auto Runner Entry Point encountered an unhandled error:', error);
        // Ensure the process exits with an error code if run in a context
        // where exit codes matter (like a simple cron job).
        process.exitCode = 1;
    } finally {
        // Optional: Gracefully close database connections if necessary
        // This depends on whether DbConnector manages connections that need explicit closing.
        // If DbConnector uses a pool that stays open, this might not be required.
        // await DbConnector.instance.closeConnections(); // Example if closeConnections exists
        logger.info('Auto Runner Entry Point execution complete.');
    }
}

// Execute the run function
run();