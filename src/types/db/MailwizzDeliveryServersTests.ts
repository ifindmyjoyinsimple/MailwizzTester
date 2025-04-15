import { MailwizzDeliveryServersTestsStatus } from "../enums/MailwizzDeliveryServersTestsStatus";

export interface MailwizzDeliveryServersTests {
    mailwizz_delivery_servers_test_id: number;
    delivery_server_id: number;
    test_insert_date: Date;
    status: MailwizzDeliveryServersTestsStatus;
    error_message?: string;
}