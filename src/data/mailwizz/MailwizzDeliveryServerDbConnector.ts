import { MailwizzDeliveryServer } from '../../types/db/mailwizz/MailwizzDeliveryServer';
import { DbConnector } from '../../utils/DbConnector';

export class MailwizzDeliveryServerDbConnector {
  private static _instance: MailwizzDeliveryServerDbConnector;
  private dbConnector: DbConnector;

  private constructor() {
    this.dbConnector = DbConnector.instance;
  }

  public static get instance(): MailwizzDeliveryServerDbConnector {
    if (!MailwizzDeliveryServerDbConnector._instance) {
      MailwizzDeliveryServerDbConnector._instance = new MailwizzDeliveryServerDbConnector();
    }
    return MailwizzDeliveryServerDbConnector._instance;
  }

  public async getDeliveryServerByName(name: string): Promise<MailwizzDeliveryServer | null> {
    const query = `
            SELECT * FROM mailwizz.mw_delivery_server 
            WHERE name = ?
        `;
    const result = await this.dbConnector.query<MailwizzDeliveryServer>(query, [name]);
    return result.rows[0] as MailwizzDeliveryServer | null;
  }

  public async getDeliveryServerById(id: number): Promise<MailwizzDeliveryServer | null> {
    const query = `
      SELECT * FROM mailwizz.mw_delivery_server 
      WHERE server_id = ?
    `;
    console.log('Getting delivery server by id:', id);
    const result = await this.dbConnector.query<MailwizzDeliveryServer>(query, [id]);
    return result.rows[0] as MailwizzDeliveryServer | null;
  }

  /**
   * Retrieves active delivery servers that have been updated within the last hour.
   * Uses database functions for time calculation.
   * @returns An array of MailwizzDeliveryServer objects.
   */
  public async getActiveServersUpdatedInLastHour(): Promise<MailwizzDeliveryServer[]> {
    // Assuming MySQL syntax for interval calculation. Adjust if using a different DB.
    const query = `
      SELECT * FROM mailwizz.mw_delivery_server
      WHERE status = 'active' AND last_updated > (NOW() - INTERVAL 1 HOUR)
    `;
    const result = await this.dbConnector.query<MailwizzDeliveryServer>(query);
    return result.rows as MailwizzDeliveryServer[];
  }

  /**
   * Retrieves active delivery servers that have NOT been tested in the last 24 hours.
   * Uses a NOT EXISTS subquery to check for absence of recent tests.
   * @returns An array of MailwizzDeliveryServer objects.
   */
  public async getActiveServersNotTestedInLast24Hours(): Promise<MailwizzDeliveryServer[]> {
    const query = `
      SELECT * FROM mailwizz.mw_delivery_server ds
      WHERE ds.status = 'active'
        AND NOT EXISTS (
          SELECT 1
          FROM infra_controller.mailwizz_delivery_servers_tests t
          WHERE t.delivery_server_id = ds.server_id
            AND t.test_insert_date > (NOW() - INTERVAL 24 HOUR)
        )
    `;
    const result = await this.dbConnector.query<MailwizzDeliveryServer>(query);
    return result.rows as MailwizzDeliveryServer[];
  }

  public async updateDeliveryServerStatus(serverId: number, status: string): Promise<void> {
    const query = `
      UPDATE mailwizz.mw_delivery_server
      SET status = ?, last_updated = NOW()
      WHERE server_id = ?
    `;
    try {
      await this.dbConnector.query(query, [status, serverId]);
    } catch (error) {
      console.error(`Error updating status for server ${serverId}:`, error);
      // Re-throw or handle as appropriate for the application's error strategy
      throw error;
    }
  }

  /**
   * Adds a new delivery server to the Mailwizz database
   * @param deliveryServer The delivery server to add
   * @returns The server_id of the newly added delivery server, or undefined if the insertion failed
   */
  public async addDeliveryServer(
    deliveryServer: MailwizzDeliveryServer
  ): Promise<number | undefined> {
    try {
      // Create the SQL INSERT query
      const query = `
                INSERT INTO mailwizz.mw_delivery_server (
                    name, hostname, username, password, port,  from_email, from_name,
                    type, status, date_added, last_updated, signing_enabled, force_from, 
                    force_from_name, force_reply_to, bounce_server_id, tracking_domain_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

      const values = [
        deliveryServer.name,
        deliveryServer.hostname,
        deliveryServer.username,
        deliveryServer.password,
        deliveryServer.port,
        deliveryServer.from_email,
        deliveryServer.from_name,
        deliveryServer.type,
        deliveryServer.status,
        deliveryServer.date_added,
        deliveryServer.last_updated,
        deliveryServer.signing_enabled,
        deliveryServer.force_from,
        deliveryServer.force_from_name,
        deliveryServer.force_reply_to,
        deliveryServer.bounce_server_id,
        deliveryServer.tracking_domain_id,
      ];

      // Execute the query
      const result = await this.dbConnector.insertQuery(query, values);

      // Return the server_id of the newly inserted delivery server
      return result.insertId;
    } catch (error) {
      console.error('Error adding delivery server:', error);
      return undefined;
    }
  }

  public async setDeliveryServerUnlimitedQuotaById(serverId: number): Promise<void> {
    const query = `
      UPDATE mailwizz.mw_delivery_server 
      SET second_quota = 0, minute_quota = 0, hourly_quota = 0, daily_quota = 0, monthly_quota = 0
      WHERE server_id = ?
    `;
    await this.dbConnector.query(query, [serverId]);
  }
}
