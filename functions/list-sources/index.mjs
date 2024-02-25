import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import { unmarshall } from "@aws-sdk/util-dynamodb";

// AWS SDK clients
const dynamodbClient = new DynamoDBClient();
const sqsClient = new SQSClient();

/**
 * Function handler
 * @param {*} event 
 * @param {*} context 
 */
export const handler = async(event, context) => {

    // Scan sources table 
    let nextScanKey = null;
    const scanItems = [];
    do{
        const scanCommand = new ScanCommand({
            TableName : process.env.DYNAMO_TABLE
        });
        if(nextScanKey){
            scanCommand.input.ExclusiveStartKey = nextScanKey;
        }
        const scanResponse = await dynamodbClient.send(scanCommand);
        nextScanKey = scanResponse.LastEvaluatedKey;
        if(scanResponse.Count > 0){
            scanItems.push(... scanResponse.Items.map(item => unmarshall(item))); 
        }
    }
    while(nextScanKey);
    
    /*
        For each source found in table, send message to queue for processing. 
        These are processed in batches of 10
    */
    for(let batchIndex = 0; batchIndex < scanItems.length; batchIndex += 10){
        const itemBatch = scanItems.slice(batchIndex, batchIndex + 10);
        const sendMessageBatchResponse = await sqsClient.send(new SendMessageBatchCommand({
            QueueUrl: process.env.QUEUE_URL,
            Entries: itemBatch.map(item => {
                const message = {
                    source: item.source,
                    type: item.type
                };
                if(item.httpHeaderOverrides){
                    message.headers = item.httpHeaderOverrides;
                }
                return {
                    Id: randomUUID(),
                    MessageBody: JSON.stringify(message)
                };
            })
        }));

        /*
            Log any SQS message send failures
            Optionally, send events for the failures to EventBridge
        */
        if(sendMessageBatchResponse.Failed){ 
            for(const failed of sendMessageBatchResponse.Failed){
                console.error("Failed to send SQS message:", JSON.stringify(failed));
            }
            await sqsClient.send(new SendMessageBatchCommand({
                QueueUrl: process.env.STANDARD_DEAD_LETTER_QUEUE_URL,
                Entries: sendMessageBatchResponse.Failed.map(failed => ({
                    Id: randomUUID(),
                    MessageBody: JSON.stringify({
                        type: "FEED_QUEUE_SEND_FAILURE",
                        data: failed
                    })
                }))
            }));
        }
    }
};