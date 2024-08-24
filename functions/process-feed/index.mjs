import { BatchWriteItemCommand, DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { DeleteMessageCommand, SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import { randomUUID } from "crypto";
import { fetchRssItems, fetchAtomItems } from './parse.mjs';


// AWS SDK clients
const dynamodbClient = new DynamoDBClient();
const sqsClient = new SQSClient();

/**
 * Function handler
 * @param {*} event
 */
export const handler = async(event) => {
    
    let failures = false;

    for(const record of event.Records){
        try{
            const { source, headers, type } = JSON.parse(record.body);
            let items = [], feedProperties = [];
            switch(type){
                case "RSS":
                    [feedProperties, items] = await fetchRssItems(source, headers);
                    break;
                case "ATOM":
                    [feedProperties, items] = await fetchAtomItems(source, headers);
                    break;
                default:
                    throw new Error(`Unrecognized feed type '${type}'`);
            }
            const storedIds = await listIds(source);
            const oldItemIds = storedIds.filter(g => items.findIndex(i => g === i.id || i.guid) === -1);
            const newItems = items.filter(i => !storedIds.includes(i.id || i.guid));
            await deleteOldItems(source, oldItemIds);
            await sendQueueMessages(source, type, feedProperties, newItems);
            await sqsClient.send(new DeleteMessageCommand({
                QueueUrl: process.env.FEED_QUEUE_URL,
                ReceiptHandle: record.receiptHandle
            }));
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

/**
 * Retrieve previously recorded GUIDs from a given source
 * @param {string} source The RSS source
 * @returns {Promise<string[]>} A set of the recorded GUIDs
 */
async function listIds(source){
    const ids = new Set();
    let nextQueryKey = null;
    do{
        const queryCommand = new QueryCommand({
            TableName : process.env.DYNAMO_TABLE,
            ExpressionAttributeNames: {
                "#S" : "source",
                "#G" : "id"
            },
            ExpressionAttributeValues: {
                ":source" : {
                    "S" : source
                }
            },
            KeyConditionExpression : "#S = :source",
            ProjectionExpression: "#G"
        });
        if(nextQueryKey){
            queryCommand.input.ExclusiveStartKey = nextQueryKey;
        }
        const queryResponse = await dynamodbClient.send(queryCommand);
        nextQueryKey = queryResponse.LastEvaluatedKey;
        if(queryResponse.Count > 0){
            queryResponse.Items.forEach((item) => ids.add(item.id.S));
        }
    }
    while(nextQueryKey);
    return Array.from(ids);
}

/**
 * Sends new items to the item queue
 * @param {string} source The source URL
 * @param {string} type The feed type
 * @param {any} feedAttributes The properties of the feed
 * @param {any[]} newItems The new feed items
 * @returns {Promise<BatchResultErrorEntry[]>} Queue messages that fail to send
 */
async function sendQueueMessages(source, type, feedAttributes, newItems){
    const messageDelaySeconds = parseInt(process.env.ITEM_DELAY);
    if(newItems.length){
        for(let batchIndex = 0; batchIndex < newItems.length; batchIndex += 10){
            const batch = newItems.slice(batchIndex, batchIndex + 10);
            const sendMessageBatchResponse = await sqsClient.send(new SendMessageBatchCommand({
                QueueUrl: process.env.ITEM_QUEUE_URL,
                Entries: batch.map((item, index) => {
                    return {
                        Id: randomUUID(),
                        MessageBody: JSON.stringify({
                            source,
                            item,
                            type,
                            feed: feedAttributes
                        }),
                        DelaySeconds: Math.min(900, batchIndex * messageDelaySeconds + (index + 1) * messageDelaySeconds)
                    };
                })
            }));
            if(sendMessageBatchResponse.Failed?.length){
                for(const failed of sendMessageBatchResponse.Failed){
                    console.error("Failed to send SQS message:", JSON.stringify(failed));
                }
                await sqsClient.send(new SendMessageBatchCommand({
                    QueueUrl: process.env.STANDARD_DEAD_LETTER_QUEUE_URL,
                    Entries: sendMessageBatchResponse.Failed.map(failed => ({
                        Id: randomUUID(),
                        MessageBody: JSON.stringify({
                            type: "ITEM_QUEUE_SEND_FAILURE",
                            data: failed
                        })
                    }))
                }));
            }
        }
    }
}   

/**
 * Delete feed items that are no longer in the feed
 * @param {string} source The RSS source
 * @param {string[]} oldItemIds Old item GUIDs to delete
 */
async function deleteOldItems(source, oldItemIds){
    if(oldItemIds.length){
        for(let batchIndex = 0; batchIndex < oldItemIds.length; batchIndex += 10){
            let timeWait = 50;
            const batch = oldItemIds.slice(batchIndex, batchIndex + 10);
            let unprocessedItems = {
                [process.env.DYNAMO_TABLE]: batch.map(id => ({
                    DeleteRequest: {
                        Key: marshall({ source, id })
                    }
                }))
            };
            do {
                const deleteResponse = await dynamodbClient.send(new BatchWriteItemCommand({
                    RequestItems: unprocessedItems
                }));
                unprocessedItems = deleteResponse.UnprocessedItems;
                await delay(timeWait);
                timeWait *= 2;
            }
            while(unprocessedItems && Object.keys(unprocessedItems).length && timeWait < 1000);
        }
    }
}

/**
 * Halt execution for a certain number of milliseconds
 * @param {number} ms The number of milliseconds to wait
 * @returns 
 */
async function delay(ms){
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}