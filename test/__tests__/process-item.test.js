import {describe, expect, test, jest} from '@jest/globals';
import {mockClient} from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import 'jest-json';
import { DeleteMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

let errorSpy = jest.spyOn(console, 'error');

function setEnvironment(){
    process.env.EVENT_BUS_NAME = "mockeventbus";
    process.env.DYNAMO_TABLE = "mockdynamodbtable";
    process.env.ITEM_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345678910/MockItemQueue";
}

let dynamodbMock = mockClient(DynamoDBClient), 
    eventBridgeMock = mockClient(EventBridgeClient), 
    sqsMock = mockClient(SQSClient);

import { handler } from "../../functions/process-item/index.mjs";

describe('process-item', () => {
    const ENVIRONMENT_BACKUP = process.env;

    beforeEach(() => {
        eventBridgeMock.reset();
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

    test('RSS item sent to event bus', async () => {

        sqsMock.on(DeleteMessageCommand).resolvesOnce({});
        dynamodbMock.on(PutItemCommand).resolvesOnce({});
        eventBridgeMock.on(PutEventsCommand).resolvesOnce({
            FailedEntryCount: 0
        });

        const event = {
            Records: [{
                messageId: "mock-message-id",
                receiptHandle: "mock-receipt-handle",
                body: JSON.stringify({
                    source: "https://mock-source.com",
                    type: "RSS",
                    item: {
                        title: "NASA Selects Blue Origin to Launch Mars’ Magnetosphere Study Mission",
                        link: "http://www.nasa.gov/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission",
                        description: "NASA has awarded Blue Origin, LLC of Kent, Washington, a task order to provide launch service for the agency’s Escape and Plasma Acceleration and Dynamics Explorers (ESCAPADE) mission as part of the agency&#039;s Venture-Class Acquisition of Dedicated and Rideshare (VADR) launch services contract.",
                        enclosure: {
                          url: "http://www.nasa.gov/sites/default/files/styles/1x1_cardfeed/public/thumbnails/image/escapade.jpeg?itok=4RKUBjZp",
                          length: "70814",
                          type: "image/jpeg"
                        },
                        guid: "http://www.nasa.gov/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission",
                        pubDate: "Thu, 09 Feb 2023 16:45 EST",
                        source: {
                          name: "NASA Breaking News",
                          url: "http://www.nasa.gov/rss/dyn/breaking_news.rss"
                        }
                    },
                    feed: {
                        title: "NASA Breaking News",
                        description: "A RSS news feed containing the latest NASA news articles and press releases.",
                        link: "http://www.nasa.gov/",
                        language: "en-us",
                        category: [ "carrot", "egg" ],
                        image: {
                          url: "https://www.w3schools.com/images/logo.gif",
                          title: "W3Schools.com",
                          link: "https://www.w3schools.com"
                        },
                        managingEditor: "jim.wilson@nasa.gov",
                        webMaster: "brian.dunbar@nasa.gov",
                        docs: "http://blogs.harvard.edu/tech/rss"
                    }
                })
            }]
        };

        await handler(event);
        expect(eventBridgeMock).toHaveReceivedCommandTimes(PutEventsCommand, 1);
        expect(eventBridgeMock).toHaveReceivedCommandWith(PutEventsCommand, {
            Entries: [{
                Source: "https://mock-source.com",
                EventBusName: "mockeventbus",
                DetailType: "NEW_FEED_ITEM",
                Detail: expect.jsonMatching({            
                    type: "RSS",
                    item: {
                        title: "NASA Selects Blue Origin to Launch Mars’ Magnetosphere Study Mission",
                        link: "http://www.nasa.gov/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission",
                        description: "NASA has awarded Blue Origin, LLC of Kent, Washington, a task order to provide launch service for the agency’s Escape and Plasma Acceleration and Dynamics Explorers (ESCAPADE) mission as part of the agency&#039;s Venture-Class Acquisition of Dedicated and Rideshare (VADR) launch services contract.",
                        enclosure: {
                        url: "http://www.nasa.gov/sites/default/files/styles/1x1_cardfeed/public/thumbnails/image/escapade.jpeg?itok=4RKUBjZp",
                        length: "70814",
                        type: "image/jpeg"
                        },
                        guid: "http://www.nasa.gov/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission",
                        pubDate: "Thu, 09 Feb 2023 16:45 EST",
                        source: {
                            name: "NASA Breaking News",
                            url: "http://www.nasa.gov/rss/dyn/breaking_news.rss"
                        }
                    },
                    feed: {
                        title: "NASA Breaking News",
                        description: "A RSS news feed containing the latest NASA news articles and press releases.",
                        link: "http://www.nasa.gov/",
                        language: "en-us",
                        category: [ "carrot", "egg" ],
                        image: {
                        url: "https://www.w3schools.com/images/logo.gif",
                        title: "W3Schools.com",
                        link: "https://www.w3schools.com"
                        },
                        managingEditor: "jim.wilson@nasa.gov",
                        webMaster: "brian.dunbar@nasa.gov",
                        docs: "http://blogs.harvard.edu/tech/rss"
                    }
                })
            }]
        });
        expect(dynamodbMock).toHaveReceivedCommandTimes(PutItemCommand, 1);
        expect(dynamodbMock).toHaveReceivedCommandWith(PutItemCommand, {
            TableName: "mockdynamodbtable",
            Item: {
                source: {
                    S: "https://mock-source.com"
                },
                id: {
                    S: "http://www.nasa.gov/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission"
                }
            }
        });
        expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
        expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockItemQueue",
            ReceiptHandlew: "mock-receipt-handle"
        });
    });

    test('Event send failure', async () => {

        eventBridgeMock.on(PutEventsCommand).resolvesOnce({
            FailedEntryCount: 1,
            Entries: [{
                EventId: "mock-event-id",
                ErrorCode: "ThrottlingException",
                ErrorMessage: "Oopsie"
            }]
        });

        const event = {
            Records: [{
                messageId: "mock-message-id",
                receiptHandle: "mock-receipt-handle",
                body: JSON.stringify({
                    source: "https://mock-source.com",
                    type: "RSS",
                    item: {
                        title: "NASA Selects Blue Origin to Launch Mars’ Magnetosphere Study Mission",
                        link: "http://www.nasa.gov/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission",
                        description: "NASA has awarded Blue Origin, LLC of Kent, Washington, a task order to provide launch service for the agency’s Escape and Plasma Acceleration and Dynamics Explorers (ESCAPADE) mission as part of the agency&#039;s Venture-Class Acquisition of Dedicated and Rideshare (VADR) launch services contract.",
                        enclosure: {
                          url: "http://www.nasa.gov/sites/default/files/styles/1x1_cardfeed/public/thumbnails/image/escapade.jpeg?itok=4RKUBjZp",
                          length: "70814",
                          type: "image/jpeg"
                        },
                        guid: "http://www.nasa.gov/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission",
                        pubDate: "Thu, 09 Feb 2023 16:45 EST",
                        source: {
                          name: "NASA Breaking News",
                          url: "http://www.nasa.gov/rss/dyn/breaking_news.rss"
                        }
                    },
                    feed: {
                        title: "NASA Breaking News",
                        description: "A RSS news feed containing the latest NASA news articles and press releases.",
                        link: "http://www.nasa.gov/",
                        language: "en-us",
                        category: [ "carrot", "egg" ],
                        image: {
                          url: "https://www.w3schools.com/images/logo.gif",
                          title: "W3Schools.com",
                          link: "https://www.w3schools.com"
                        },
                        managingEditor: "jim.wilson@nasa.gov",
                        webMaster: "brian.dunbar@nasa.gov",
                        docs: "http://blogs.harvard.edu/tech/rss"
                    }
                })
            }]
        };
        let caughtError;
        try{
            await handler(event);
        }
        catch(error){
            caughtError = error;
        }
        expect(eventBridgeMock).toHaveReceivedCommandTimes(PutEventsCommand, 1);
        expect(eventBridgeMock).toHaveReceivedCommandWith(PutEventsCommand, {
            Entries: [{
                Source: "https://mock-source.com",
                EventBusName: "mockeventbus",
                DetailType: "NEW_FEED_ITEM",
                Detail: expect.jsonMatching({            
                    type: "RSS",
                    item: {
                        title: "NASA Selects Blue Origin to Launch Mars’ Magnetosphere Study Mission",
                        link: "http://www.nasa.gov/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission",
                        description: "NASA has awarded Blue Origin, LLC of Kent, Washington, a task order to provide launch service for the agency’s Escape and Plasma Acceleration and Dynamics Explorers (ESCAPADE) mission as part of the agency&#039;s Venture-Class Acquisition of Dedicated and Rideshare (VADR) launch services contract.",
                        enclosure: {
                        url: "http://www.nasa.gov/sites/default/files/styles/1x1_cardfeed/public/thumbnails/image/escapade.jpeg?itok=4RKUBjZp",
                        length: "70814",
                        type: "image/jpeg"
                        },
                        guid: "http://www.nasa.gov/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission",
                        pubDate: "Thu, 09 Feb 2023 16:45 EST",
                        source: {
                            name: "NASA Breaking News",
                            url: "http://www.nasa.gov/rss/dyn/breaking_news.rss"
                        }
                    },
                    feed: {
                        title: "NASA Breaking News",
                        description: "A RSS news feed containing the latest NASA news articles and press releases.",
                        link: "http://www.nasa.gov/",
                        language: "en-us",
                        category: [ "carrot", "egg" ],
                        image: {
                        url: "https://www.w3schools.com/images/logo.gif",
                        title: "W3Schools.com",
                        link: "https://www.w3schools.com"
                        },
                        managingEditor: "jim.wilson@nasa.gov",
                        webMaster: "brian.dunbar@nasa.gov",
                        docs: "http://blogs.harvard.edu/tech/rss"
                    }
                })
            }]
        });
        expect(dynamodbMock).not.toHaveReceivedCommand(PutItemCommand);
        expect(sqsMock).not.toHaveReceivedCommand(DeleteMessageCommand);
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith("Message ID: mock-message-id", expect.any(Error));
        expect(errorSpy.mock.calls[0][1].message.startsWith("Failed to put EventBridge event: ")).toBe(true);
        expect(errorSpy.mock.calls[0][1].message.split("Failed to put EventBridge event: ").pop()).toEqual(expect.jsonMatching({
            EventId: "mock-event-id",
            ErrorCode: "ThrottlingException",
            ErrorMessage: "Oopsie"
        }));
        expect(caughtError.message).toEqual("At least one or more SQS messages failed to process");
    });
});