import { TestDeliveryServer } from "./lambda/TestDeliveryServer";

(async () => {
    const testDeliveryServer = new TestDeliveryServer();
    await testDeliveryServer.handleTestDeliveryServer(7);
})();