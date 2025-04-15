# Plan: Adapt Code to `mailwizz_delivery_servers_tests` Schema Change

This document outlines the necessary code changes to adapt to the updated database schema for the `mailwizz_delivery_servers_tests` table.

**New Schema:**

```sql
CREATE TABLE `mailwizz_delivery_servers_tests` (
  `mailwizz_delivery_servers_test_id` int NOT NULL AUTO_INCREMENT,
  `delivery_server_id` int NOT NULL,
  `status` enum('FAILED','SUCCESSFUL') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SUCCESSFUL',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `test_insert_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`mailwizz_delivery_servers_test_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AVG_ROW_LENGTH=8192 ROW_FORMAT=DYNAMIC;
```

**Required Code Changes:**

1.  **Update Enum (`src/types/enums/MailwizzDeliveryServersTestsStatus.ts`):**
    *   Remove the `PENDING` status (`PENDING = 'MAILWIZZ_TEST_PENDING',`).
    *   Update the string value for `SUCCESSFUL` to `'SUCCESSFUL'`.
    *   Update the string value for `FAILED` to `'FAILED'`.

2.  **Update Type Interface (`src/types/db/MailwizzDeliveryServersTests.ts`):**
    *   Remove the `date_last_tested?: Date;` property.

3.  **Update Database Connector (`src/data/MailwizzDeliveryServersTestsDbConnector.ts`):**
    *   **`create` method:**
        *   Modify the `INSERT` query to remove the `status` column from the explicitly set columns, allowing the database default (`SUCCESSFUL`) to be used.
        *   Remove the `status` parameter from the values passed to the query.
    *   **`update` method:**
        *   Remove the `date_last_tested = CASE ... END` logic from the `UPDATE` SQL query.
        *   Adjust the parameters passed to the query accordingly (remove the third parameter which was `status || null`).
    *   **`upsert` method:**
        *   Remove `date_last_tested` from the column list in the `INSERT` SQL query.
        *   Remove the corresponding `NOW()` value from the `VALUES` list in the `INSERT` query.
    *   **`getById` method (Recommendation):**
        *   Modify the `SELECT *` query to explicitly list the columns: `mailwizz_delivery_servers_test_id`, `delivery_server_id`, `status`, `error_message`, `test_insert_date`.

4.  **Review Service Logic (`src/services/MailwizzTester.ts`):**
    *   Verify logic remains correct after enum/type changes. No direct code changes are anticipated, as the service uses the enum values which will now map to the new database strings.

**Summary Diagram:**

```mermaid
graph TD
    A[DB Schema Change] --> B(Update Enum: MailwizzDeliveryServersTestsStatus.ts);
    A --> C(Update Type: MailwizzDeliveryServersTests.ts);
    B --> D(Update DB Connector: MailwizzDeliveryServersTestsDbConnector.ts);
    C --> D;
    D --> E(Review Service: MailwizzTester.ts);

    subgraph "File Changes"
        B: Remove PENDING, Update SUCCESSFUL/FAILED values
        C: Remove date_last_tested
        D: Update create() to use DB default, Update update(), Update upsert(), Update getById()
        E: Verify logic still correct after enum/type changes
    end

    style B fill:#f9f,stroke:#333,stroke-width:2px
    style C fill:#f9f,stroke:#333,stroke-width:2px
    style D fill:#f9f,stroke:#333,stroke-width:2px
    style E fill:#ccf,stroke:#333,stroke-width:2px