import { DeleteMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

// AWS SDK clients
const sqsClient = new SQSClient();
const eventBridgeClient = new EventBridgeClient();

/**
 * Function handler
 * @param {*} event
 */
export const handler = async(event) => {
    const entries = [];
    for(const record of event.Records){
        try{
            const eventEntry = {
                Source: "dlq",
                EventBusName: process.env.EVENT_BUS_NAME
            };
            switch(record.attributes.DeadLetterQueueSourceArn){
                case process.env.FEED_QUEUE_ARN:
                    eventEntry.DetailType = "FEED_QUEUE_PROCESSING_FAILURE";
                    eventEntry.Detail = JSON.stringify(record);
                    break;
                case process.env.ITEM_QUEUE_ARN:
                    eventEntry.DetailType = "ITEM_QUEUE_PROCESSING_FAILURE";
                    eventEntry.Detail = JSON.stringify(record);
                    break;
                default:
                    const { type, data } = JSON.parse(record.body);
                    eventEntry.DetailType = type;
                    eventEntry.Detail = JSON.stringify(data)
                    break; 
            }
            entries.push(eventEntry);
        }
        catch(error){
            console.error(error);
        }
        finally {
            await sqsClient.send(new DeleteMessageCommand({
                QueueUrl: process.env.STANDARD_DEAD_LETTER_QUEUE_URL,
                ReceiptHandlew: record.receiptHandle
            }));
        }
    }
    for(let batchIndex = 0; batchIndex < entries.length; batchIndex += 10){
        try{
            const batch = entries.slice(batchIndex, batchIndex + 10);
            const putErrorEventsResponse = await eventBridgeClient.send(new PutEventsCommand({
                Entries: batch
            }));
            if(putErrorEventsResponse.FailedEntryCount){
                for(const entry of putErrorEventsResponse.Entries){
                    if(entry.ErrorCode || entry.ErrorMessage){
                        console.error("Error sending event:", JSON.stringify(entry));
                    }
                }
            }
        }
        catch(error){
            console.error(error);
        }
    }
};