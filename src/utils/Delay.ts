import { Logger } from './Logger';

/**
 * Utility class for asynchronous delay operations
 */
export class Delay {
  /**
   * Creates an asynchronous delay using Promises
   * @param ms Milliseconds to wait
   * @returns Promise that resolves after the specified delay
   */
  public static wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Synchronous delay method that blocks the current thread
   * @param milliseconds Time to wait in milliseconds
   */
  public static waitSync(milliseconds: number): void {
    const logger = Logger.instance;
    logger.info(`Waiting for ${milliseconds / 1000} seconds...`);
    const startTime = new Date().getTime();
    let currentTime = startTime;

    while (currentTime - startTime < milliseconds) {
      Delay.wait(100); // Short sleep to avoid CPU busy waiting
      currentTime = new Date().getTime();
    }

    logger.info('Wait completed');
  }
}
