import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MailwizzTester } from '../services/MailwizzTester';
import { DefaultHeaders } from '../types/constants/DefaultHeaders';

export class TestDeliveryServer {
    private _mailwizzTester: MailwizzTester;

    constructor() {
        this._mailwizzTester = new MailwizzTester();
    }

    public async handleTestDeliveryServer(deliveryServerId: number): Promise<APIGatewayProxyResult> {

        try {
            await this._mailwizzTester.runForDeliveryServer(deliveryServerId);
        } catch (error) {
            console.error('Error in TestDeliveryServer handler:', error);
            return makeResponse(500, "Test failed");
        }
        return makeResponse(200, "Test completed successfully");
    }
}

/**
 * Handler function for the test-delivery-server endpoint
 * @param event - API Gateway event
 * @returns API Gateway response
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const testDeliveryServer = new TestDeliveryServer();
    const deliveryServerId = event.queryStringParameters?.deliveryServerId
        ? parseInt(event.queryStringParameters.deliveryServerId)
        : undefined;

    if (!deliveryServerId) {
        console.log("Delivery server ID not found or invalid.");
        return makeResponse(404, "Delivery server ID not found or invalid.");
    }
    return testDeliveryServer.handleTestDeliveryServer(deliveryServerId);
};


function makeResponse(statusCode: number, message: string): APIGatewayProxyResult {
    return {
        statusCode,
        body: JSON.stringify({ message }),
        headers: DefaultHeaders,
    };
}