import { AutoRunnerService } from './services/AutoRunnerService';
import { Logger } from './utils/Logger';
import { DbConnector } from './utils/DbConnector';
import { Delay } from './utils/Delay';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Entry point for the automated Mailwizz delivery server testing process.
 *
 * This script instantiates the AutoRunnerService and triggers the test cycle in a loop.
 * It should be executed by a scheduler or as a long-running process.
 */
async function main() {
    const logger = Logger.instance;
    logger.info('Starting Auto Runner Entry Point...');

    // Set up graceful shutdown handler
    process.on('SIGINT', async () => {
        logger.info('Received SIGINT. Gracefully shutting down...');
        await DbConnector.instance.close();
        logger.info('Database connection closed. Exiting.');
        process.exit(0);
    });

    const autoRunner = new AutoRunnerService();

    // Run indefinitely
    while (true) {
        try {
            logger.info(`Running auto test cycle at ${new Date().toISOString()}`);
            await autoRunner.runAutoTestCycle();
            logger.info('Auto test cycle completed successfully.');
        } catch (error) {
            logger.error('Error in auto test cycle:', error);
        }

        const minutesToWait = process.env.DELAY_BETWEEN_RUNS_MINUTES ? parseInt(process.env.DELAY_BETWEEN_RUNS_MINUTES) : 60;
        logger.info(`Waiting ${minutesToWait} minutes until next execution. Next run at ${new Date(Date.now() + minutesToWait * 60000).toISOString()}`);
        await Delay.wait(minutesToWait * 60000);
    }
}

// Execute the main function
main().catch(async (error) => {
    const logger = Logger.instance;
    logger.error('Fatal error in main loop:', error);
    await DbConnector.instance.close();
    process.exit(1);
});