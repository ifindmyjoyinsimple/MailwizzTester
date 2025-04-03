import { MailwizzTesterController } from './controllers/MailwizzTesterController';

(async () => {
  const testDeliveryServer = new MailwizzTesterController();
  await testDeliveryServer.handleTestDeliveryServer(7);
})();
