import { marshall } from '@aws-sdk/util-dynamodb';
import { DeleteMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

// AWS SDK clients
const dynamodbClient = new DynamoDBClient();
const sqsClient = new SQSClient();
const eventBridgeClient = new EventBridgeClient();

/**
 * Function handler
 * @param {*} event
 */
export const handler = async(event) => {

    let failures = false;

    for(const record of event.Records){
        try{
            const { source, item, feed, type } = JSON.parse(record.body);

            // Put EventBridge event for every new item
            const putEventsResponse = await eventBridgeClient.send(new PutEventsCommand({
                Entries: [{
                    Source: source,
                    Detail: JSON.stringify({ item, feed, type }),
                    EventBusName: process.env.EVENT_BUS_NAME,
                    DetailType: "NEW_FEED_ITEM"
                }]
            }));
    
            // If EventBridge event fails to send, log error and optionally send error event
            if(putEventsResponse.FailedEntryCount){
                failures = true;
                throw new Error(`Failed to put EventBridge event: ${JSON.stringify(putEventsResponse.Entries[0])}`);
            }
            else{
                /*
                    Place a DynamoDB record of the ID of the new item.
                    This is to ensure that duplicate events are not sent for RSS items
                */
                await dynamodbClient.send(new PutItemCommand({
                    TableName: process.env.DYNAMO_TABLE,
                    Item: marshall({
                        source: source,
                        id: item.guid || item.id
                    })
                }));
    
                // SQS message has been sucessfully processed, so it is now deleted from the queue to prevent a retry
                await sqsClient.send(new DeleteMessageCommand({
                    QueueUrl: process.env.ITEM_QUEUE_URL,
                    ReceiptHandlew: record.receiptHandle
                }));
            }
        }
        catch(error){
            console.error(`Message ID: ${record.messageId}`, error);
            failures = true;
        }
    }
    /*
        If a failure occurs in processing a message, throw an error. This will
        trigger a retry for any SQS messages processed that have not been deleted from the queue
    */
    if(failures){
        throw new Error("At least one or more SQS messages failed to process");
    }
};