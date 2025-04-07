import { MailwizzTesterController } from './controllers/MailwizzTesterController';
import { MailwizzTester } from './services/MailwizzTester';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

(async () => {
  const testDeliveryServer = new MailwizzTester();
  await testDeliveryServer.runForDeliveryServer(7);
})();
