import { DbConnector } from '../utils/DbConnector';
import { Logger } from '../utils/Logger';
import { MailboxEmailLinksClickerEmail } from '../types/db/MailboxEmailLinksClickerEmail';
export class MailboxEmailLinksClickerEmailsDbConnector {
    private static _instance: MailboxEmailLinksClickerEmailsDbConnector;
    private dbConnector: DbConnector;
    private logger: Logger;

    private constructor() {
        this.dbConnector = DbConnector.instance;
        this.logger = Logger.instance;
    }

    public static get instance(): MailboxEmailLinksClickerEmailsDbConnector {
        if (!MailboxEmailLinksClickerEmailsDbConnector._instance) {
            MailboxEmailLinksClickerEmailsDbConnector._instance = new MailboxEmailLinksClickerEmailsDbConnector();
        }
        return MailboxEmailLinksClickerEmailsDbConnector._instance;
    }

    public async getEmailBySubjectUuid(subjectUuid: string): Promise<MailboxEmailLinksClickerEmail | null> {
        try {
            const query = `
                SELECT * FROM marketing_automation.mailbox_emails_links_clicker_emails
                WHERE email_subject LIKE ?
            `;
            const searchValue = `%${subjectUuid}%`;

            const result = await this.dbConnector.query<MailboxEmailLinksClickerEmail>(query, [searchValue]);

            return result.rows[0] ?? null;
        } catch (error) {
            this.logger.error('Failed to get email by subject uuid:', error);
            throw error;
        }
    }
}