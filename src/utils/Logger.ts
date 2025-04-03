import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';

// This file implements a Logger class that wraps Pino logger with a focus on immediate file writing
// The main goal is to prevent buffering so logs are written to the file in the correct sequence
// It also logs to both standard console and VS Code debug console

// Create logs directory if it doesn't exist
const logsDirectory = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDirectory)) {
  fs.mkdirSync(logsDirectory, { recursive: true });
}

// Configure log file path
const logFilePath = path.join(logsDirectory, 'application.log');

export class Logger {
  private static _instance: Logger;
  private logger: pino.Logger;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Set log level based on environment
    // In production we only log info and above, while in development we include debug logs
    const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

    // Create a destination stream with sync=true to ensure immediate writes
    // The sync option is critical - it disables buffering and forces logs to be written immediately
    // This prevents out-of-sequence logging where later messages appear before earlier ones
    const fileStream = pino.destination({
      dest: logFilePath, // Path to the log file
      sync: true, // This forces immediate write to disk without buffering
      // When sync is true, the write() operations are synchronous
      // and logs are guaranteed to be on disk before continuing execution
    });

    // Create a pretty console transport for better readability
    const prettyStream = pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true, // Add colors based on log level
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss', // Format timestamps
        ignore: 'pid,hostname', // Hide unnecessary fields
      },
    });

    // Create the Pino logger with multistream to log to both console and file
    // We need to handle both outputs while ensuring the file writes are immediate
    this.logger = pino(
      {
        // Base configuration
        level: logLevel, // Minimum log level to record
        timestamp: pino.stdTimeFunctions.isoTime, // Use ISO timestamp format

        // Customize the output format
        formatters: {
          // Format the level field to be uppercase (INFO instead of info)
          level: label => {
            return { level: label.toUpperCase() };
          },
        },
      },
      // Use multistream to write to both console and file
      pino.multistream([
        // Console pretty-printed output
        { stream: prettyStream },
        // File output with immediate writes
        { stream: fileStream },
      ])
    );
  }

  /**
   * Gets the singleton instance of Logger
   * Creates the instance if it doesn't exist
   */
  public static get instance(): Logger {
    if (!Logger._instance) {
      Logger._instance = new Logger();
    }
    return Logger._instance;
  }

  /**
   * Log an informational message
   * This method logs to the file synchronously and also outputs to both console and VS Code debug console
   */
  public info(message: string, ...meta: any[]): void {
    // Extract metadata object from parameters if provided
    const metaObj = meta.length > 0 ? meta[0] : {};

    // Log via Pino to file (immediate due to sync:true) and standard console
    this.logger.info(metaObj, message);

    // Also log specifically to VS Code debug console
    // This ensures the logs are visible in the VS Code OUTPUT tab
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(metaObj).length ? JSON.stringify(metaObj) : '';
    console.log(`${timestamp} INFO: ${message} ${metaStr}`);
  }

  /**
   * Log an error message with optional error details
   * This method logs to the file synchronously and also outputs to both console and VS Code debug console
   */
  public error(message: string, error?: Error | unknown): void {
    // Log via Pino to file (immediate) and standard console
    if (error instanceof Error) {
      const errorObj = {
        error: error.message,
        stack: error.stack,
      };

      // Log via Pino
      this.logger.error(errorObj, message);

      // Also log to VS Code debug console
      console.error(`${new Date().toISOString()} ERROR: ${message}`, errorObj);
    } else {
      // Log via Pino
      this.logger.error({ error }, message);

      // Also log to VS Code debug console
      console.error(`${new Date().toISOString()} ERROR: ${message}`, error || '');
    }
  }

  /**
   * Log a debug message
   * This method logs to the file synchronously and also outputs to both console and VS Code debug console
   * These logs will only appear when the log level is 'debug'
   */
  public debug(message: string, ...meta: any[]): void {
    // Extract metadata object from parameters if provided
    const metaObj = meta.length > 0 ? meta[0] : {};

    // Log via Pino to file (immediate) and standard console
    this.logger.debug(metaObj, message);

    // Also log specifically to VS Code debug console
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(metaObj).length ? JSON.stringify(metaObj) : '';
    console.debug(`${timestamp} DEBUG: ${message} ${metaStr}`);
  }

  /**
   * Log a warning message
   * This method logs to the file synchronously and also outputs to both console and VS Code debug console
   */
  public warn(message: string, ...meta: any[]): void {
    // Extract metadata object from parameters if provided
    const metaObj = meta.length > 0 ? meta[0] : {};

    // Log via Pino to file (immediate) and standard console
    this.logger.warn(metaObj, message);

    // Also log specifically to VS Code debug console
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(metaObj).length ? JSON.stringify(metaObj) : '';
    console.warn(`${timestamp} WARN: ${message} ${metaStr}`);
  }
}

// Test function to demonstrate logger functionality
function testLogger(): void {
  // Create a new logger instance using the singleton pattern
  const logger = Logger.instance;

  // Example logs at different levels
  logger.info('Starting logger test');
  logger.debug('This is a debug message with some data', {
    userId: 123,
    action: 'test',
  });
  logger.warn('This is a warning message');

  // Example of error logging with stack trace
  try {
    throw new Error('Test error message');
  } catch (error) {
    logger.error('An error occurred during testing', error);
  }

  logger.info('Logger test completed');
}

// Run the test
// testLogger();
