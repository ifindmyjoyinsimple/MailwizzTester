# Implementation Plan: Auto-Run Strategy

**Goal:** Implement an automated process that periodically checks Mailwizz delivery servers, runs tests on those that require it (due to updates or lack of recent tests), and deactivates servers that fail the test.

**Assumptions:**

1.  The database connection logic within the `DbConnector` utility and the existing connectors is functional.
2.  The core testing logic within `MailwizzTester.runForDeliveryServer` correctly determines test success or failure (even if it doesn't yet handle the status update on failure).
3.  The `last_updated` field in the `mw_delivery_server` table is reliably updated whenever a server's configuration changes.
4.  The `test_insert_date` field in `mw_delivery_servers_tests` accurately reflects when a test was recorded.
5.  A mechanism (e.g., cron job, scheduled Lambda function) will be set up externally to trigger the entry point of this auto-run process periodically. This plan focuses on the core logic, not the scheduling mechanism itself.

**Proposed Implementation Plan:**

**1. Enhance `MailwizzDeliveryServerDbConnector` (`src/data/mailwizz/MailwizzDeliveryServerDbConnector.ts`)**

*   **Add Method: `getDeliveryServersByStatus`**
    *   **Purpose:** Fetch all delivery servers matching a given status.
    *   **Signature:** `public async getDeliveryServersByStatus(status: string): Promise<MailwizzDeliveryServer[]>`
    *   **Logic:**
        *   Execute a SQL query: `SELECT * FROM mw_delivery_server WHERE status = ?` (using the provided `status` parameter).
        *   Map the results to an array of `MailwizzDeliveryServer` objects.
        *   Return the array.
*   **Add Method: `updateDeliveryServerStatus`**
    *   **Purpose:** Update the status of a specific delivery server.
    *   **Signature:** `public async updateDeliveryServerStatus(serverId: number, status: string): Promise<void>`
    *   **Logic:**
        *   Execute a SQL query: `UPDATE mw_delivery_server SET status = ?, last_updated = NOW() WHERE server_id = ?` (using the provided `status` and `serverId`).
        *   Handle potential errors (e.g., server not found).

**2. Enhance `MailwizzDeliveryServersTestsDbConnector` (`src/data/MailwizzDeliveryServersTestsDbConnector.ts`)**

*   **Add Method: `getLatestTestForServer`**
    *   **Purpose:** Retrieve the most recent test record for a given delivery server ID.
    *   **Signature:** `public async getLatestTestForServer(serverId: number): Promise<MailwizzDeliveryServersTests | null>`
    *   **Logic:**
        *   Execute a SQL query: `SELECT * FROM mw_delivery_servers_tests WHERE delivery_server_id = ? ORDER BY test_insert_date DESC LIMIT 1` (using the provided `serverId`).
        *   If a record is found, map it to a `MailwizzDeliveryServersTests` object and return it.
        *   If no record is found, return `null`.

**3. Modify `MailwizzTester` (`src/services/MailwizzTester.ts`)**

*   **Update `runForDeliveryServer` Method:**
    *   **Inject Dependency:** Add `MailwizzDeliveryServerDbConnector` to the constructor or fetch its instance within the method.
    *   **Modify Logic:**
        *   Wrap the existing core test execution logic within a `try...catch` block.
        *   **Inside the `try` block (after successful test execution):** Ensure the logic correctly calls `MailwizzDeliveryServersTestsDbConnector.instance.create(...)` to record the successful test. (This might already exist but needs verification).
        *   **Inside the `catch` block (or if the test logic explicitly determines failure):**
            *   Log the error.
            *   Call `MailwizzDeliveryServerDbConnector.instance.updateDeliveryServerStatus(mailwizzDeliveryServerId, 'inactive')`.
            *   Consider re-throwing the error or returning a specific failure status if needed by the caller.

**4. Create New Service: `AutoRunnerService` (`src/services/AutoRunnerService.ts`)**

*   **Purpose:** Orchestrate the auto-run process.
*   **Class:** `AutoRunnerService`
*   **Dependencies (Inject or get instances):**
    *   `MailwizzDeliveryServerDbConnector`
    *   `MailwizzDeliveryServersTestsDbConnector`
    *   `MailwizzTester`
    *   `Logger` (optional, for logging the process)
*   **Method: `runAutoTestCycle`**
    *   **Signature:** `public async runAutoTestCycle(): Promise<void>`
    *   **Logic:**
        1.  Log the start of the cycle.
        2.  Fetch active servers: `const activeServers = await MailwizzDeliveryServerDbConnector.instance.getDeliveryServersByStatus('active');`
        3.  Log the number of active servers found.
        4.  Iterate through `activeServers`: `for (const server of activeServers)`
            *   Fetch the latest test: `const latestTest = await MailwizzDeliveryServersTestsDbConnector.instance.getLatestTestForServer(server.server_id);`
            *   Determine if a test is needed:
                *   `let needsTest = false;`
                *   `if (!latestTest)`: `needsTest = true;` (No previous test)
                *   `else if (latestTest.test_insert_date < server.last_updated)`: `needsTest = true;` (Server updated since last test)
            *   If `needsTest`:
                *   Log that a test is being initiated for `server.server_id`.
                *   `try { await MailwizzTester.instance.runForDeliveryServer(server.server_id); } catch (error) { Logger.error(`Test failed for server ${server.server_id}:`, error); // Log error, status update happens within runForDeliveryServer }`
            *   Else:
                *   Log that no test is needed for `server.server_id`.
        5.  Log the end of the cycle.

**5. Create Entry Point (`src/index.ts` or a new file e.g., `src/auto-runner-entry.ts`)**

*   **Purpose:** To initiate the `AutoRunnerService`. This is the file that the external scheduler (cron/Lambda) would execute.
*   **Logic:**
    *   Import `AutoRunnerService`.
    *   Create an instance: `const autoRunner = new AutoRunnerService();`
    *   Call the main method: `autoRunner.runAutoTestCycle().then(() => console.log('Auto-run cycle complete.')).catch(err => console.error('Auto-run cycle failed:', err));`
    *   Include necessary setup (e.g., environment variable loading, DB connection initialization if not handled automatically).

**Execution Flow Diagram (Mermaid):**

```mermaid
sequenceDiagram
    participant Scheduler
    participant EntryPoint
    participant AutoRunnerService
    participant DeliveryServerDbConnector as DS_DB
    participant TestDbConnector as Test_DB
    participant MailwizzTester

    Scheduler->>EntryPoint: Trigger Run
    EntryPoint->>AutoRunnerService: runAutoTestCycle()
    AutoRunnerService->>DS_DB: getDeliveryServersByStatus('active')
    DS_DB-->>AutoRunnerService: activeServers[]
    loop For each server in activeServers
        AutoRunnerService->>Test_DB: getLatestTestForServer(server.id)
        Test_DB-->>AutoRunnerService: latestTest (or null)
        alt Needs Test (no test OR test < server.last_updated)
            AutoRunnerService->>MailwizzTester: runForDeliveryServer(server.id)
            MailwizzTester->>Test_DB: create(testResult) // On Success
            Test_DB-->>MailwizzTester: OK
            MailwizzTester-->>AutoRunnerService: Success
        else Test Fails within MailwizzTester
            MailwizzTester->>DS_DB: updateDeliveryServerStatus(server.id, 'inactive')
            DS_DB-->>MailwizzTester: OK
            MailwizzTester-->>AutoRunnerService: Throw Error / Failure
        end
        else No Test Needed
            AutoRunnerService-->>AutoRunnerService: Skip test
        end
    end
    AutoRunnerService-->>EntryPoint: Completion / Error
    EntryPoint-->>Scheduler: Exit Status