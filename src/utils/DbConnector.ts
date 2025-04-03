import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * A singleton database connector class that provides asynchronous MySQL queries
 * using a single connection
 */
export class DbConnector {
  private static _instance: DbConnector;
  private pool: mysql.Pool | null = null;
  private connectionConfig: mysql.PoolOptions;

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
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
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
      const pool = await this.ensurePool();
      const [rows] = await pool.query(sql, params || []);
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
      if (this.pool) {
        await this.pool.end();
        console.log('Database connection pool closed');
        this.pool = null;
      }
    } catch (error) {
      console.error('Error closing database connection pool:', error);
      throw error;
    }
  }

  /**
   * Ensures a connection pool exists before executing a query
   * Creates a new pool if one doesn't exist
   */
  private async ensurePool(): Promise<mysql.Pool> {
    if (!this.pool) {
      this.pool = mysql.createPool(this.connectionConfig);
      console.log('Database connection pool established');
    }
    return this.pool;
  }
}
