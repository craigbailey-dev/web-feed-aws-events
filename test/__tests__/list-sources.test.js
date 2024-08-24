import {describe, expect, test, jest} from '@jest/globals';
import {mockClient} from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import 'jest-json';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';

const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

let errorSpy = jest.spyOn(console, 'error');

function setEnvironment(){
    process.env.DYNAMO_TABLE = "mockdynamodbtable";
    process.env.QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345678910/MockQueue";
    process.env.STANDARD_DEAD_LETTER_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345678910/MockDeadLetterQueue";
}

let dynamodbMock = mockClient(DynamoDBClient), 
    sqsMock = mockClient(SQSClient);

import { handler } from "../../functions/list-sources/index.mjs";

describe('list-sources', () => {

    const ENVIRONMENT_BACKUP = process.env;

    beforeEach(() => {
        dynamodbMock.reset();
        sqsMock.reset();
        errorSpy.mockReset();
        setEnvironment();
    });

    afterEach(() => {
        process.env = { ...ENVIRONMENT_BACKUP };
    });
    
    afterAll(() => {
        process.env = ENVIRONMENT_BACKUP;
    });

    test('No sources returned', async () => {
        dynamodbMock.on(ScanCommand).resolvesOnce({
            Items: [],
            Count: 0
        });

        

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
        dynamodbMock.on(ScanCommand).resolvesOnce({
            Items: [{
                source: {
                    S: "https://mock-source.com"
                },
                type: {
                    S: "RSS"
                }
            }],
            Count: 1
        });

        sqsMock.on(SendMessageBatchCommand).resolvesOnce({

        });

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
                Id: expect.stringMatching(uuidRegex),
                MessageBody: expect.jsonMatching({
                    source: "https://mock-source.com",
                    type: "RSS"
                })
            }]
        });
    });

    test('Multiple pages of sources found', async () => {
        dynamodbMock.on(ScanCommand).resolvesOnce({
            Items: [{
                source: {
                    S: "https://mock-source-1.com",
                },
                type: {
                    S: "RSS"
                }
            },
            {
                source: {
                    S: "https://mock-source-2.com",
                },
                type: {
                    S: "RSS"
                }
            }],
            Count: 2,
            LastEvaluatedKey: {
                source: {
                    S: "https://mock-source-2.com"
                }
            }
        }).resolvesOnce({
            Items: [{
                source: {
                    S: "https://mock-source-3.com"
                },
                type: {
                    S: "ATOM"
                }
            },
            {
                source: {
                    S: "https://mock-source-4.com"
                },
                type: {
                    S: "RSS"
                },
                httpHeaderOverrides: {
                    M: {
                        "X-Custom-Header": {
                            S: "CustomValue"
                        }
                    }
                }
            }],
            Count: 2
        });

        sqsMock.on(SendMessageBatchCommand).resolvesOnce({ });

        const event = {};
        const context = {};

        await handler(event, context);

        expect(dynamodbMock).toHaveReceivedCommandTimes(ScanCommand, 2);
        expect(dynamodbMock).toHaveReceivedNthCommandWith(1,ScanCommand, {
            TableName: "mockdynamodbtable"
        });
        expect(dynamodbMock).toHaveReceivedNthCommandWith(2,ScanCommand, {
            TableName: "mockdynamodbtable",
            ExclusiveStartKey: {
                source: {
                    S: "https://mock-source-2.com"
                }
            }
        });
        expect(sqsMock).toHaveReceivedCommandTimes(SendMessageBatchCommand, 1);
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageBatchCommand, {
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockQueue",
            Entries: [ 
                {
                    Id: expect.stringMatching(uuidRegex),
                    MessageBody: expect.jsonMatching({
                        source: "https://mock-source-1.com",
                        type: "RSS"
                    })
                },
                {
                    Id: expect.stringMatching(uuidRegex),
                    MessageBody: expect.jsonMatching({
                        source: "https://mock-source-2.com",
                        type: "RSS"
                    })
                },
                {
                    Id: expect.stringMatching(uuidRegex),
                    MessageBody: expect.jsonMatching({
                        source: "https://mock-source-3.com",
                        type: "ATOM"
                    })
                },
                {
                    Id: expect.stringMatching(uuidRegex),
                    MessageBody: expect.jsonMatching({
                        source: "https://mock-source-4.com",
                        type: "RSS",
                        headers: {
                            "X-Custom-Header": "CustomValue"
                        }
                    })
                }
        ]});
    });

    test('Item failed to be sent', async () => {
        dynamodbMock.on(ScanCommand).resolvesOnce({
            Items: [{
                source: {
                    S: "https://mock-source.com"
                },
                type: {
                    S: "RSS"
                }
            }],
            Count: 1
        });

        sqsMock.on(SendMessageBatchCommand).resolvesOnce({
            Failed: [{
                Id: "mock-failed-id",
                Code: "NEEDS_MORE_COWBELL",
                SenderFault: true,
                Message: "Oopsie"
            }]
        }).resolvesOnce({});

        

        const event = {};
        const context = {};

        await handler(event, context);

        expect(dynamodbMock).toHaveReceivedCommandTimes(ScanCommand, 1);
        expect(dynamodbMock).toHaveReceivedCommandWith(ScanCommand, {
            TableName: "mockdynamodbtable"
        });
        expect(sqsMock).toHaveReceivedCommandTimes(SendMessageBatchCommand, 2);
        expect(sqsMock).toHaveReceivedNthCommandWith(1, SendMessageBatchCommand, {
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockQueue",
            Entries: [ {
                Id: expect.stringMatching(uuidRegex),
                MessageBody: expect.jsonMatching({
                    source: "https://mock-source.com",
                    type: "RSS"
                })
            }]
        });
        expect(sqsMock).toHaveReceivedNthCommandWith(2, SendMessageBatchCommand, {
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockDeadLetterQueue",
            Entries: [ {
                Id: expect.stringMatching(uuidRegex),
                MessageBody: expect.jsonMatching({
                    type: "FEED_QUEUE_SEND_FAILURE",
                    data: {
                        Id: "mock-failed-id",
                        Code: "NEEDS_MORE_COWBELL",
                        SenderFault: true,
                        Message: "Oopsie"
                    }
                })
            }]
        });
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith("Failed to send SQS message:", expect.jsonMatching({
            Id: "mock-failed-id",
            Code: "NEEDS_MORE_COWBELL",
            SenderFault: true,
            Message: "Oopsie"
        }));
    });
});