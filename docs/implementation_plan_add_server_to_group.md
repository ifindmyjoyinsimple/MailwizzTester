# Implementation Plan: Add Delivery Server to Customer Group

**Goal:** Automatically add a successfully tested delivery server to a specific customer group (`group_id = 2`) in the `mw_delivery_server_to_customer_group` table.

**Implementation Steps:**

1.  **Define Constant for Group ID:**
    *   **File:** `src/types/constants/GlobalConstants.ts`
    *   **Action:** Add a new constant for the static `group_id`.
    *   **Code:** `export const MAILWIZZ_DEFAULT_CUSTOMER_GROUP_ID = 2;`

2.  **Create Database Type Definition:**
    *   **File:** `src/types/db/mailwizz/MailwizzDeliveryServerToCustomerGroup.ts` (New File)
    *   **Action:** Define the TypeScript interface representing the structure of the `mw_delivery_server_to_customer_group` table.
    *   **Content:**
        ```typescript
        export interface MailwizzDeliveryServerToCustomerGroup {
          server_id: number;
          group_id: number;
        }
        ```

3.  **Create Database Connector:**
    *   **File:** `src/data/mailwizz/MailwizzDeliveryServerToCustomerGroupDbConnector.ts` (New File)
    *   **Action:** Create a new singleton class to handle interactions with the `mw_delivery_server_to_customer_group` table.
    *   **Method Name:** `addDeliveryServerToCustomerGroup`
    *   **Content:**
        ```typescript
        import { DbConnector } from '../../utils/DbConnector';
        import { MailwizzDeliveryServerToCustomerGroup } from '../../types/db/mailwizz/MailwizzDeliveryServerToCustomerGroup';
        import { Logger } from '../../utils/Logger'; // Add Logger import

        export class MailwizzDeliveryServerToCustomerGroupDbConnector {
          private static _instance: MailwizzDeliveryServerToCustomerGroupDbConnector;
          private dbConnector: DbConnector;
          private logger: Logger; // Add logger instance

          private constructor() {
            this.dbConnector = DbConnector.instance;
            this.logger = Logger.instance; // Initialize logger
          }

          public static get instance(): MailwizzDeliveryServerToCustomerGroupDbConnector {
            if (!MailwizzDeliveryServerToCustomerGroupDbConnector._instance) {
              MailwizzDeliveryServerToCustomerGroupDbConnector._instance = new MailwizzDeliveryServerToCustomerGroupDbConnector();
            }
            return MailwizzDeliveryServerToCustomerGroupDbConnector._instance;
          }

          /**
           * Adds a mapping between a delivery server and a customer group if it doesn't already exist.
           * @param serverId The ID of the delivery server.
           * @param groupId The ID of the customer group.
           */
          public async addDeliveryServerToCustomerGroup(serverId: number, groupId: number): Promise<void> {
            try {
              // Check if the mapping already exists
              const checkQuery = `
                SELECT server_id FROM mailwizz.mw_delivery_server_to_customer_group
                WHERE server_id = ? AND group_id = ?
              `;
              const existingMapping = await this.dbConnector.querySingle<MailwizzDeliveryServerToCustomerGroup>(checkQuery, [serverId, groupId]);

              if (existingMapping) {
                this.logger.info(`Mapping for server_id ${serverId} and group_id ${groupId} already exists.`);
                return; // Mapping already exists, do nothing
              }

              // If mapping doesn't exist, insert it
              const insertQuery = `
                INSERT INTO mailwizz.mw_delivery_server_to_customer_group (server_id, group_id)
                VALUES (?, ?)
              `;
              await this.dbConnector.insertQuery(insertQuery, [serverId, groupId]);
              this.logger.info(`Successfully added mapping for server_id ${serverId} and group_id ${groupId}.`);

            } catch (error) {
              this.logger.error(`Error adding delivery server to customer group mapping (Server: ${serverId}, Group: ${groupId}):`, error);
              // Decide if re-throwing is necessary or if logging is sufficient
              // throw error; // Uncomment if the calling process needs to handle the error
            }
          }
        }
        ```

4.  **Integrate into MailwizzTester Service:**
    *   **File:** `src/services/MailwizzTester.ts`
    *   **Action:** Import the new connector and constant, instantiate the connector, and call the `addDeliveryServerToCustomerGroup` method after a successful test.
    *   **Changes:**
        *   **Add Imports:**
            ```typescript
            import { MailwizzDeliveryServerToCustomerGroupDbConnector } from '../data/mailwizz/MailwizzDeliveryServerToCustomerGroupDbConnector';
            import { MAILWIZZ_DEFAULT_CUSTOMER_GROUP_ID } from '../types/constants/GlobalConstants';
            ```
        *   **Add Property:**
            ```typescript
            private mailwizzDeliveryServerToCustomerGroupDbConnector: MailwizzDeliveryServerToCustomerGroupDbConnector;
            ```
        *   **Instantiate in Constructor:**
            ```typescript
            this.mailwizzDeliveryServerToCustomerGroupDbConnector = MailwizzDeliveryServerToCustomerGroupDbConnector.instance;
            ```
        *   **Call `addDeliveryServerToCustomerGroup` in `runForDeliveryServer`:** Insert the call after the successful status update:
            ```typescript
                  // Step 7: Update the delivery server test status to successful
                  await this.mailwizzDeliveryServersTestsDbConnector.upsert(mailwizzDeliveryServerId, MailwizzDeliveryServersTestsStatus.SUCCESSFUL);

                  // Step 8: Add delivery server to the default customer group
                  this.logger.info(`Attempting to add server ${mailwizzDeliveryServerId} to group ${MAILWIZZ_DEFAULT_CUSTOMER_GROUP_ID}`);
                  await this.mailwizzDeliveryServerToCustomerGroupDbConnector.addDeliveryServerToCustomerGroup(
                    mailwizzDeliveryServerId,
                    MAILWIZZ_DEFAULT_CUSTOMER_GROUP_ID
                  );

                  this.logger.info(`Test for Delivery Server ${mailwizzDeliveryServer!.server_id} completed successfully`);
            ```

**Flow Diagram (Mermaid):**

```mermaid
graph TD
    A[MailwizzTester.runForDeliveryServer] --> B{Test Successful?};
    B -- Yes --> C[Update Test Status to SUCCESSFUL];
    C --> D[Instantiate MailwizzDeliveryServerToCustomerGroupDbConnector];
    D --> E[Call addDeliveryServerToCustomerGroup(serverId, MAILWIZZ_DEFAULT_CUSTOMER_GROUP_ID)];
    E --> F{Mapping Exists?};
    F -- No --> G[INSERT into mw_delivery_server_to_customer_group];
    F -- Yes --> H[Log: Mapping Exists];
    G --> I[Log: Success];
    H --> J[End];
    I --> J;
    B -- No --> K[Update Test Status to FAILED];
    K --> L[Throw Error / End];

    subgraph MailwizzDeliveryServerToCustomerGroupDbConnector
        direction LR
        E --> F
        F -- No --> G
        F -- Yes --> H
        G --> I
    end

    subgraph GlobalConstants
        E -- Uses --> M[MAILWIZZ_DEFAULT_CUSTOMER_GROUP_ID]
    end