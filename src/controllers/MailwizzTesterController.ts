import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MailwizzTester } from '../services/MailwizzTester';
import { DefaultHeaders } from '../types/constants/DefaultHeaders';

export class MailwizzTesterController {
  private _mailwizzTester: MailwizzTester;

  constructor() {
    this._mailwizzTester = new MailwizzTester();
  }

  public async handleRequest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const deliveryServerId = parseInt(event.queryStringParameters!.getDeliveryServerById!);
      await this._mailwizzTester.runForDeliveryServer(deliveryServerId);
    } catch (error) {
      console.error('Error in TestDeliveryServer handler:', error);
      return {
        statusCode: 500,
        body: error instanceof Error ? error.message : JSON.stringify(error),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Test completed successfully' }),
    };
  }
}

export const handler = async (event: APIGatewayProxyEvent) => {
  const mailwizzTesterController = new MailwizzTesterController();
  return mailwizzTesterController.handleRequest(event);
};
