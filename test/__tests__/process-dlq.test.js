import {describe, expect, test, jest} from '@jest/globals';
import {mockClient} from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import 'jest-json';
import { DeleteMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

let errorSpy = jest.spyOn(console, 'error');

function setEnvironment(){
    process.env.EVENT_BUS_NAME = "mockeventbus";
    process.env.FEED_QUEUE_ARN = "arn:aws:sqs:us-east-1:12345678910:MockFeedQueue";
    process.env.ITEM_QUEUE_ARN = "arn:aws:sqs:us-east-1:12345678910:MockItemQueue";
    process.env.STANDARD_DEAD_LETTER_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/12345678910/MockDeadLetterQueue";
}

let eventBridgeMock = mockClient(EventBridgeClient), 
    sqsMock = mockClient(SQSClient);

import { handler } from "../../functions/process-dlq/index.mjs";

describe('process-dlq', () => {

    const ENVIRONMENT_BACKUP = process.env;

    beforeEach(() => {
        eventBridgeMock.reset();
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

    test('Feed queue processing failure', async () => {

        sqsMock.on(DeleteMessageCommand).resolvesOnce({});
        eventBridgeMock.on(PutEventsCommand).resolvesOnce({
            FailedEntryCount: 0
        });

        const event = {
            Records: [{
                messageId: "mock-message-id",
                receiptHandle: "mock-receipt-handle",
                attributes: {
                    DeadLetterQueueSourceArn: "arn:aws:sqs:us-east-1:12345678910:MockFeedQueue"
                },
                body: JSON.stringify({
                    source: "https://mock-source.com",
                    type: "RSS"
                })
            }]
        };

        await handler(event);

        expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
        expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockDeadLetterQueue",
            ReceiptHandlew: "mock-receipt-handle"
        });
        expect(eventBridgeMock).toHaveReceivedCommandTimes(PutEventsCommand, 1);
        expect(eventBridgeMock).toHaveReceivedCommandWith(PutEventsCommand, {
            Entries: [{
                Source: "dlq",
                EventBusName: "mockeventbus",
                DetailType: "FEED_QUEUE_PROCESSING_FAILURE",
                Detail: expect.jsonMatching({
                    messageId: "mock-message-id",
                    receiptHandle: "mock-receipt-handle",
                    attributes: {
                        DeadLetterQueueSourceArn: "arn:aws:sqs:us-east-1:12345678910:MockFeedQueue"
                    },
                    body: JSON.stringify({
                        source: "https://mock-source.com",
                        type: "RSS"
                    })
                })
            }]
        });
    });


    test('Item queue processing failure', async () => {

        sqsMock.on(DeleteMessageCommand).resolvesOnce({});
        eventBridgeMock.on(PutEventsCommand).resolvesOnce({
            FailedEntryCount: 0
        });

        const event = {
            Records: [{
                messageId: "mock-message-id",
                receiptHandle: "mock-receipt-handle",
                attributes: {
                    DeadLetterQueueSourceArn: "arn:aws:sqs:us-east-1:12345678910:MockItemQueue"
                },
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

        expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
        expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockDeadLetterQueue",
            ReceiptHandlew: "mock-receipt-handle"
        });
        expect(eventBridgeMock).toHaveReceivedCommandTimes(PutEventsCommand, 1);
        expect(eventBridgeMock).toHaveReceivedCommandWith(PutEventsCommand, {
            Entries: [{
                Source: "dlq",
                EventBusName: "mockeventbus",
                DetailType: "ITEM_QUEUE_PROCESSING_FAILURE",
                Detail: expect.jsonMatching({            
                    messageId: "mock-message-id",
                    receiptHandle: "mock-receipt-handle",
                    attributes: {
                        DeadLetterQueueSourceArn: "arn:aws:sqs:us-east-1:12345678910:MockItemQueue"
                    },
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
                })
            }]
        });
    });

    test('Feed queue send failure', async () => {

        sqsMock.on(DeleteMessageCommand).resolvesOnce({});
        eventBridgeMock.on(PutEventsCommand).resolvesOnce({
            FailedEntryCount: 0
        });

        const event = {
            Records: [{
                messageId: "mock-message-id",
                receiptHandle: "mock-receipt-handle",
                attributes: {},
                body: JSON.stringify({
                    type: "FEED_QUEUE_SEND_FAILURE",
                    data: {
                        Id: "mock-failed-id",
                        Code: "NEEDS_MORE_COWBELL",
                        SenderFault: true,
                        Message: "Oopsie"
                    }
                })
            }]
        };

        await handler(event);

        expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
        expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockDeadLetterQueue",
            ReceiptHandlew: "mock-receipt-handle"
        });
        expect(eventBridgeMock).toHaveReceivedCommandTimes(PutEventsCommand, 1);
        expect(eventBridgeMock).toHaveReceivedCommandWith(PutEventsCommand, {
            Entries: [{
                Source: "dlq",
                EventBusName: "mockeventbus",
                DetailType: "FEED_QUEUE_SEND_FAILURE",
                Detail: expect.jsonMatching({
                    Id: "mock-failed-id",
                    Code: "NEEDS_MORE_COWBELL",
                    SenderFault: true,
                    Message: "Oopsie"
                })
            }]
        });
    });

    test('Item queue send failure', async () => {

        sqsMock.on(DeleteMessageCommand).resolvesOnce({});
        eventBridgeMock.on(PutEventsCommand).resolvesOnce({
            FailedEntryCount: 0
        });

        const event = {
            Records: [{
                messageId: "mock-message-id",
                receiptHandle: "mock-receipt-handle",
                attributes: {},
                body: JSON.stringify({
                    type: "ITEM_QUEUE_SEND_FAILURE",
                    data: {
                        Id: "mock-failed-id",
                        Code: "NEEDS_MORE_COWBELL",
                        SenderFault: true,
                        Message: "Oopsie"
                    }
                })
            }]
        };

        await handler(event);

        expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
        expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockDeadLetterQueue",
            ReceiptHandlew: "mock-receipt-handle"
        });
        expect(eventBridgeMock).toHaveReceivedCommandTimes(PutEventsCommand, 1);
        expect(eventBridgeMock).toHaveReceivedCommandWith(PutEventsCommand, {
            Entries: [{
                Source: "dlq",
                EventBusName: "mockeventbus",
                DetailType: "ITEM_QUEUE_SEND_FAILURE",
                Detail: expect.jsonMatching({
                    Id: "mock-failed-id",
                    Code: "NEEDS_MORE_COWBELL",
                    SenderFault: true,
                    Message: "Oopsie"
                })
            }]
        });
    });

    test('Event send failure', async () => {

        sqsMock.on(DeleteMessageCommand).resolvesOnce({});
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
                attributes: {},
                body: JSON.stringify({
                    type: "ITEM_QUEUE_SEND_FAILURE",
                    data: {
                        Id: "mock-failed-id",
                        Code: "NEEDS_MORE_COWBELL",
                        SenderFault: true,
                        Message: "Oopsie"
                    }
                })
            }]
        };

        await handler(event);

        expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
        expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockDeadLetterQueue",
            ReceiptHandlew: "mock-receipt-handle"
        });
        expect(eventBridgeMock).toHaveReceivedCommandTimes(PutEventsCommand, 1);
        expect(eventBridgeMock).toHaveReceivedCommandWith(PutEventsCommand, {
            Entries: [{
                Source: "dlq",
                EventBusName: "mockeventbus",
                DetailType: "ITEM_QUEUE_SEND_FAILURE",
                Detail: expect.jsonMatching({
                    Id: "mock-failed-id",
                    Code: "NEEDS_MORE_COWBELL",
                    SenderFault: true,
                    Message: "Oopsie"
                })
            }]
        });
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith("Error sending event:", expect.jsonMatching({
            EventId: "mock-event-id",
            ErrorCode: "ThrottlingException",
            ErrorMessage: "Oopsie"
        }));
    });

    test('Partial event send failure', async () => {

        sqsMock.on(DeleteMessageCommand).resolvesOnce({});
        eventBridgeMock.on(PutEventsCommand).resolvesOnce({
            FailedEntryCount: 1,
            Entries: [{
                EventId: "mock-event-id-1"
            },
            {
                EventId: "mock-event-id-2",
                ErrorCode: "ThrottlingException",
                ErrorMessage: "Oopsie"
            }]
        });

        const event = {
            Records: [{
                messageId: "mock-message-id-1",
                receiptHandle: "mock-receipt-handle-1",
                attributes: {},
                body: JSON.stringify({
                    type: "ITEM_QUEUE_SEND_FAILURE",
                    data: {
                        Id: "mock-failed-id-1",
                        Code: "NEEDS_MORE_COWBELL",
                        SenderFault: true,
                        Message: "Oh no"
                    }
                })
            },
            {
                messageId: "mock-message-id-2",
                receiptHandle: "mock-receipt-handle-2",
                attributes: {},
                body: JSON.stringify({
                    type: "ITEM_QUEUE_SEND_FAILURE",
                    data: {
                        Id: "mock-failed-id-2",
                        Code: "NEEDS_EVEN_MORE_COWBELL",
                        SenderFault: true,
                        Message: "uh oh"
                    }
                })
            }]
        };

        await handler(event);

        expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 2);
        expect(sqsMock).toHaveReceivedNthCommandWith(1, DeleteMessageCommand, {
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockDeadLetterQueue",
            ReceiptHandlew: "mock-receipt-handle-1"
        });
        expect(sqsMock).toHaveReceivedNthCommandWith(2, DeleteMessageCommand, {
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockDeadLetterQueue",
            ReceiptHandlew: "mock-receipt-handle-2"
        });
        expect(eventBridgeMock).toHaveReceivedCommandTimes(PutEventsCommand, 1);
        expect(eventBridgeMock).toHaveReceivedCommandWith(PutEventsCommand, {
            Entries: [{
                Source: "dlq",
                EventBusName: "mockeventbus",
                DetailType: "ITEM_QUEUE_SEND_FAILURE",
                Detail: expect.jsonMatching({
                    Id: "mock-failed-id-1",
                    Code: "NEEDS_MORE_COWBELL",
                    SenderFault: true,
                    Message: "Oh no"
                })
            },
            {
                Source: "dlq",
                EventBusName: "mockeventbus",
                DetailType: "ITEM_QUEUE_SEND_FAILURE",
                Detail: expect.jsonMatching({
                    Id: "mock-failed-id-2",
                    Code: "NEEDS_EVEN_MORE_COWBELL",
                    SenderFault: true,
                    Message: "uh oh"
                })
            }]
        });
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith("Error sending event:", expect.jsonMatching({
            EventId: "mock-event-id-2",
            ErrorCode: "ThrottlingException",
            ErrorMessage: "Oopsie"
        }));
    });


    test('Event send error thrown', async () => {
        sqsMock.on(DeleteMessageCommand).resolvesOnce({});
        eventBridgeMock.on(PutEventsCommand).rejectsOnce(new Error("Needs more cowbell"));
        const event = {
            Records: [{
                messageId: "mock-message-id",
                receiptHandle: "mock-receipt-handle",
                attributes: {},
                body: JSON.stringify({
                    type: "ITEM_QUEUE_SEND_FAILURE",
                    data: {
                        Id: "mock-failed-id",
                        Code: "NEEDS_MORE_COWBELL",
                        SenderFault: true,
                        Message: "Oopsie"
                    }
                })
            }]
        };

        await handler(event);

        expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
        expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockDeadLetterQueue",
            ReceiptHandlew: "mock-receipt-handle"
        });
        expect(eventBridgeMock).toHaveReceivedCommandTimes(PutEventsCommand, 1);
        expect(eventBridgeMock).toHaveReceivedCommandWith(PutEventsCommand, {
            Entries: [{
                Source: "dlq",
                EventBusName: "mockeventbus",
                DetailType: "ITEM_QUEUE_SEND_FAILURE",
                Detail: expect.jsonMatching({
                    Id: "mock-failed-id",
                    Code: "NEEDS_MORE_COWBELL",
                    SenderFault: true,
                    Message: "Oopsie"
                })
            }]
        });
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
        expect(errorSpy.mock.calls[0][0].message).toEqual("Needs more cowbell");
    });

    test('Record procesing error thrown', async () => {
        sqsMock.on(DeleteMessageCommand).resolvesOnce({});
        const event = {
            Records: [{
                messageId: "mock-message-id",
                receiptHandle: "mock-receipt-handle",
                attributes: {},
                body: "{"
            }]
        };

        await handler(event);

        expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
        expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockDeadLetterQueue",
            ReceiptHandlew: "mock-receipt-handle"
        });
        expect(eventBridgeMock).not.toHaveReceivedCommand(PutEventsCommand);
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    });
});