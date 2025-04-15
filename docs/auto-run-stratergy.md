In order to make this project fully automated, we need to do the following:

# the entry point:
- get all delievry servers from table `mailwizz.mw_delivery_server ` using MailwizzDeliveryServerDbConnector class.
    - conditions: 
        - status should be active. 
- for each delivery server, check if we have a test record using `MailwizzDeliveryServersTestsDbConnector` class, where test_insert_date is greater than the last_updated of the delivery server from above step. This would mean, the delivery server was updated after the last time test was run on it, and we need to re run the test.

- for each such delivery server, we run the `MailwizzTester` -> `runForDeliveryServer` method.

# change in `runForDeliveryServer`
- if the test fails, update the status in `mailwizz.mw_delivery_server` table to be inactive