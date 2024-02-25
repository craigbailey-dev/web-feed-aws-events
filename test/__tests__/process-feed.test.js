import {describe, expect, test, jest} from '@jest/globals';
import {mockClient} from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import 'jest-json';
import { readFileSync } from 'fs';
import { BatchWriteItemCommand, DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { DeleteMessageCommand, SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import axios from 'axios';

let errorSpy = jest.spyOn(console, 'error');

jest.mock('axios');

function setEnvironment(){
    process.env.DYNAMO_TABLE = "mockdynamodbtable";
    process.env.ITEM_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345678910/MockItemQueue";
    process.env.FEED_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345678910/MockFeedQueue";
    process.env.STANDARD_DEAD_LETTER_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345678910/MockDeadLetterQueue";
}

let dynamodbMock = mockClient(DynamoDBClient),
    sqsMock = mockClient(SQSClient);

import { handler } from "../../functions/process-feed/index.mjs";

describe('process-item', () => {
    const ENVIRONMENT_BACKUP = process.env;

    beforeEach(() => {
        sqsMock.reset();
        dynamodbMock.reset();
        errorSpy.mockReset();
        setEnvironment();
    });

    afterEach(() => {
        process.env = { ...ENVIRONMENT_BACKUP };
    });
    
    afterAll(() => {
        process.env = ENVIRONMENT_BACKUP;
    });

    test('ATOM feed processed', async () => {
        sqsMock.on(DeleteMessageCommand).resolvesOnce({});
        sqsMock.on(SendMessageBatchCommand).resolvesOnce({});
        dynamodbMock.on(QueryCommand).resolvesOnce({
            Count: 0,
            Items: []
        });
        const atomContent = readFileSync("test/files/atom-1.atom", {encoding: "utf-8"});
        axios.get.mockResolvedValueOnce({
            data: atomContent
        });
        const event = {
            Records: [{
                messageId: "mock-message-id",
                receiptHandle: "mock-receipt-handle",
                attributes: {},
                body: JSON.stringify({
                    source: "https://mock-source.com",
                    type: "ATOM"
                })
            }]
        };
        await handler(event);
    }); 
});