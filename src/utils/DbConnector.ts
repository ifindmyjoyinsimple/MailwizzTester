import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * A singleton database connector class that provides asynchronous MySQL queries
 * using a single connection
 */
export class DbConnector {
  private static _instance: DbConnector;
  private connection: mysql.Connection | null = null;
  private connectionConfig: mysql.ConnectionOptions;

  /**
   * Private constructor to enforce singleton pattern
   * Stores connection configuration for later use
   */
  private constructor(config?: {
    host?: string;
    user?: string;
    password?: string;
    database?: string;
    port?: number;
  }) {
    // Use configuration from .env file or passed config
    this.connectionConfig = {
      host: config?.host || process.env.DB_HOST,
      user: config?.user || process.env.DB_USER,
      password: config?.password || process.env.DB_PASSWORD,
      database: config?.database || process.env.DB_NAME,
      port: config?.port || parseInt(process.env.DB_PORT || '3306'),
    };
    
    console.log('Database connector initialized');
  }

  /**
   * Gets the singleton instance of DbConnector
   * Creates the instance if it doesn't exist
   */
  public static get instance(): DbConnector {
    if (!DbConnector._instance) {
      DbConnector._instance = new DbConnector();
    }
    return DbConnector._instance;
  }

  
  /**
   * Execute a query asynchronously
   * This method returns a promise that resolves when the query completes
   * @param sql The SQL query to execute
   * @param params Query parameters
   * @returns The query results as an array
   */
  public async query<T>(sql: string, params?: any[]): Promise<{ rows: T[] }> {
    try {
      const connection = await this.ensureConnection();
      const [rows] = await connection.query(sql, params || []);
      return { rows: rows as T[] };
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Execute a query and return a single row or null
   * @param sql The SQL query to execute
   * @param params Query parameters
   * @returns The first row or null if no rows found
   */
  public async querySingle<T>(sql: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.rows.length > 0 ? results.rows[0] : null;
  }

  /**
   * Execute an INSERT query and return the insert ID and affected rows
   * @param sql The INSERT query to execute
   * @param params Query parameters
   * @returns Object containing insertId and affectedRows
   */
  public async insertQuery(sql: string, params?: any[]): Promise<{ insertId: number; affectedRows: number }> {
    const result = await this.query<any>(sql, params);
    return result.rows as unknown as { insertId: number; affectedRows: number };
  }

  /**
   * Closes the database connection
   * Should be called when the application is shutting down
   */
  public async close(): Promise<void> {
    try {
      if (this.connection) {
        await this.connection.end();
        console.log('Database connection closed');
        this.connection = null;
      }
    } catch (error) {
      console.error('Error closing database connection:', error);
      throw error;
    }
  }

  /**
   * Ensures a connection exists before executing a query
   * Creates a new connection if one doesn't exist or is closed
   */
  private async ensureConnection(): Promise<mysql.Connection> {
    // Create a connection if it doesn't exist
    if (!this.connection) {
      this.connection = await mysql.createConnection(this.connectionConfig);
      console.log('Database connection established');
    }
    return this.connection;
  }

}
