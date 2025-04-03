import { DbConnector } from '../../utils/DbConnector';
import { MAILWIZZ_TEST_BOUNCE_EMAIL, MAILWIZZ_TEST_LIST_ID, MAILWIZZ_TEST_RECIPIENT_EMAIL } from '../../types/constants/GlobalConstants';

export class MailwizzListSubscriberDbConnector {
  private static _instance: MailwizzListSubscriberDbConnector;
  private dbConnector: DbConnector;

  private constructor() {
    this.dbConnector = DbConnector.instance;
  }

  public static get instance(): MailwizzListSubscriberDbConnector {
    if (!MailwizzListSubscriberDbConnector._instance) {
      MailwizzListSubscriberDbConnector._instance = new MailwizzListSubscriberDbConnector();
    }
    return MailwizzListSubscriberDbConnector._instance;
  }

  public async deleteTestBounceEmailFromBlacklist(): Promise<void> {
    try {
      const deleteQuery = `
        DELETE FROM mailwizz.mw_email_blacklist 
        WHERE email = ?
      `;

      await this.dbConnector.query(deleteQuery, [MAILWIZZ_TEST_BOUNCE_EMAIL]);
    } catch (error) {
      console.error('Error deleting test email from blacklist:', error);
    }
  }

  public async updateTestEmailsSubscriptionStatusToConfirmed(): Promise<void> {
    try {
      const updateQuery = `
        UPDATE mailwizz.mw_list_subscriber
        SET status = 'confirmed'
        WHERE email IN (?, ?) AND list_id = ?
      `;

      await this.dbConnector.query(updateQuery, [
        MAILWIZZ_TEST_BOUNCE_EMAIL,
        MAILWIZZ_TEST_RECIPIENT_EMAIL,
        MAILWIZZ_TEST_LIST_ID
      ]);
    } catch (error) {
      console.error('Error updating test email subscription status:', error);
    }
  }


}
