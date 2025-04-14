In the main `MailwizzTester.ts` class when the delivery server passes the tests, we want to add the delivery server to the mailwizz table: `mw_delivery_server_to_customer_group`.

The shape of the table is: `server_id`, `group_id`.

`server_id` would the the id of current delivery server that's being tested and has passed.

`group_id` is static: `2`. May be add this to `GlobalConstants.ts` file?

Things we may need to do:
1. Create the type
2. Create the Db connector for this table
3. Add method to add this mapping in Db Connector (may be check if the mapping already exists?)
4. Update `MailwizzTester.ts` to call the method after tests pass.