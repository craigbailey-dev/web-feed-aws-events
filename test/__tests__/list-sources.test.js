import {describe, expect, test, jest} from '@jest/globals';
import {mockClient} from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import * as Joi from "joi";
import { matchers } from "jest-joi";
expect.extend(matchers);

const uuidV4Schema = Joi.string().uuid({version: "uuidv4"})

function setEnvironment(errorEvents = true){
    process.env.DYNAMO_TABLE = "mockdynamodbtable";
    process.env.QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345678910/MockQueue";
    process.env.SEND_ERROR_EVENTS = errorEvents ? "true" : "false";
    process.env.STANDARD_DEAD_LETTER_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345678910/MockDeadLetterQueue";
}

describe('list-sources', () => {

    let dynamodbMock = mockClient(DynamoDBClient), 
        sqsMock = mockClient(SQSClient);

    const ENVIRONMENT_BACKUP = process.env;

    beforeEach(() => {
        dynamodbMock.reset();
        sqsMock.reset();
        process.env = { ...ENVIRONMENT_BACKUP };
    });
    
    afterAll(() => {
        process.env = ENVIRONMENT_BACKUP;
    });

    test('No sources returned', async () => {

        setEnvironment();

        dynamodbMock.on(ScanCommand).resolvesOnce({
            Items: [],
            Count: 0
        });

        const { handler } = await import("../../functions/list-sources/index.mjs");

        const event = {};
        const context = {};

        await handler(event, context);

        expect(dynamodbMock).toHaveReceivedCommandTimes(ScanCommand, 1);
        expect(dynamodbMock).toHaveReceivedCommandWith(ScanCommand, {
            TableName: "mockdynamodbtable"
        });
        expect(sqsMock).not.toHaveReceivedCommand(SendMessageBatchCommand);
    });

    test('Item sent to queue', async () => {

        setEnvironment();
        
        dynamodbMock.on(ScanCommand).resolvesOnce({
            Items: [{
                source: {
                    S: "https://mock-source.com"
                }
            }],
            Count: 1
        });

        sqsMock.on(SendMessageBatchCommand).resolvesOnce({

        });

        const { handler } = await import("../../functions/list-sources/index.mjs");

        const event = {};
        const context = {};

        await handler(event, context);

        expect(dynamodbMock).toHaveReceivedCommandTimes(ScanCommand, 1);
        expect(dynamodbMock).toHaveReceivedCommandWith(ScanCommand, {
            TableName: "mockdynamodbtable"
        });
        expect(sqsMock).toHaveReceivedCommandTimes(SendMessageBatchCommand, 1);
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageBatchCommand, {
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockQueue",
            Entries: [ {
                Id: expect.any(String),
                MessageBody: expect.any(String)
            }]
        });
        expect(sqsMock.calls()[0].args[0].input.Entries[0].Id).toMatchSchema(uuidV4Schema);
        expect(JSON.parse(sqsMock.calls()[0].args[0].input.Entries[0].MessageBody)).toEqual({
            source: "https://mock-source.com"
        });
    });
});