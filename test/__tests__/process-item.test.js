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
                        title: "Something very important has happened",
                        link: "http://www.example.com/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission",
                        description: "This is a very informative item. Wow. Amazing",
                        enclosure: {
                          url: "http://www.example.com/sites/default/files/styles/1x1_cardfeed/public/thumbnails/image/escapade.jpeg?itok=4RKUBjZp",
                          length: "70814",
                          type: "image/jpeg"
                        },
                        guid: "http://www.example.com/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission",
                        pubDate: "Thu, 09 Feb 2023 16:45 EST",
                        source: {
                          name: "Breaking News",
                          url: "http://www.example.com/rss/dyn/breaking_news.rss"
                        }
                    },
                    feed: {
                        title: "Breaking News",
                        description: "A RSS news feed containing the latest news",
                        link: "http://www.example.com/",
                        language: "en-us",
                        category: [ "carrot", "egg" ],
                        image: {
                          url: "https://www.example.com/images/logo.gif",
                          title: "example.com",
                          link: "https://www.example.com"
                        },
                        managingEditor: "john.doe@example.com",
                        webMaster: "jane.doe@example.com",
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
                        title: "Something very important has happened",
                        link: "http://www.example.com/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission",
                        description: "This is a very informative item. Wow. Amazing",
                        enclosure: {
                        url: "http://www.example.com/sites/default/files/styles/1x1_cardfeed/public/thumbnails/image/escapade.jpeg?itok=4RKUBjZp",
                        length: "70814",
                        type: "image/jpeg"
                        },
                        guid: "http://www.example.com/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission",
                        pubDate: "Thu, 09 Feb 2023 16:45 EST",
                        source: {
                            name: "Breaking News",
                            url: "http://www.example.com/rss/dyn/breaking_news.rss"
                        }
                    },
                    feed: {
                        title: "Breaking News",
                        description: "A RSS news feed containing the latest news",
                        link: "http://www.example.com/",
                        language: "en-us",
                        category: [ "carrot", "egg" ],
                        image: {
                        url: "https://www.example.com/images/logo.gif",
                        title: "example.com",
                        link: "https://www.example.com"
                        },
                        managingEditor: "john.doe@example.com",
                        webMaster: "jane.doe@example.com",
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
                    S: "http://www.example.com/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission"
                }
            }
        });
        expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
        expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockItemQueue",
            ReceiptHandlew: "mock-receipt-handle"
        });
    });

    test('ATOM item sent to event bus', async () => {

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
                    type: "ATOM",
                    item: {
                        source: {
                          id: "abc123",
                          title: "my-awesome-title",
                          updated: "2005-07-31T12:29:29Z"
                        },
                        title: {
                          text: "Atom draft-07 snapshot"
                        },
                        links: [
                          {
                            href: "http://example.org/2005/04/02/atom",
                            rel: "alternate",
                            type: "text/html"
                          },
                          {
                            href: "http://example.org/audio/ph34r_my_podcast.mp3",
                            rel: "enclosure",
                            type: "audio/mpeg",
                            length: "1337"
                          }
                        ],
                        id: "my-awesome-entry-1",
                        updated: "2005-07-31T12:29:29Z",
                        published: "2003-12-13T08:29:29-04:00",
                        author: {
                          name: "Craig Bailey",
                          uri: "Craig Bailey",
                          email: "craigbailey@example.com"
                        },
                        contributors: [
                          {
                            name: "John Doe",
                            uri: "John Doe"
                          },
                          {
                            name: "Jane Doe",
                            uri: "Jane Doe"
                          }
                        ],
                        categories: [
                          {
                            term: "EntryCategoryTerm1",
                            label: "EntryCategoryLabel1"
                          },
                          {
                            term: "EntryCategoryTerm2",
                            label: "EntryCategoryLabel2"
                          }
                        ],
                        content: {
                          type: "xhtml",
                          text: "<div><p>My entry content</p></div>"
                        }
                    },
                    feed: {
                        title: {
                          type: "text",
                          text: "My Awesome Feed Title"
                        },
                        updated: "2005-07-31T12:29:29Z",
                        id: "tag:example.org,2003:3",
                        links: [
                          {
                            href: "http://example.org/",
                            rel: "alternate",
                            type: "text/html",
                            hreflang: "en"
                          },
                          {
                            href: "http://example.org/feed.atom",
                            rel: "self",
                            type: "application/atom+xml"
                          }
                        ],
                        rights: {
                          text: "Copyright (c) 2003, Craig Bailey"
                        },
                        generator: {
                          uri: "http://www.example.com/",
                          version: "1.0"
                        },
                        categories: [
                          {
                            term: "FeedCategoryTerm1",
                            label: "FeedCategoryLabel1"
                          },
                          {
                            term: "FeedCategoryTerm2",
                            label: "FeedCategoryLabel2"
                          }
                        ],
                        author: {
                          name: "Craig Bailey",
                          uri: "Craig Bailey",
                          email: "f8dy@example.com"
                        },
                        contributors: [
                          {
                            name: "John Doe",
                            uri: "John Doe"
                          },
                          {
                            name: "Jane Doe",
                            uri: "Jane Doe"
                          }
                        ]
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
                    type: "ATOM",
                    item: {
                        source: {
                          id: "abc123",
                          title: "my-awesome-title",
                          updated: "2005-07-31T12:29:29Z"
                        },
                        title: {
                          text: "Atom draft-07 snapshot"
                        },
                        links: [
                          {
                            href: "http://example.org/2005/04/02/atom",
                            rel: "alternate",
                            type: "text/html"
                          },
                          {
                            href: "http://example.org/audio/ph34r_my_podcast.mp3",
                            rel: "enclosure",
                            type: "audio/mpeg",
                            length: "1337"
                          }
                        ],
                        id: "my-awesome-entry-1",
                        updated: "2005-07-31T12:29:29Z",
                        published: "2003-12-13T08:29:29-04:00",
                        author: {
                          name: "Craig Bailey",
                          uri: "Craig Bailey",
                          email: "craigbailey@example.com"
                        },
                        contributors: [
                          {
                            name: "John Doe",
                            uri: "John Doe"
                          },
                          {
                            name: "Jane Doe",
                            uri: "Jane Doe"
                          }
                        ],
                        categories: [
                          {
                            term: "EntryCategoryTerm1",
                            label: "EntryCategoryLabel1"
                          },
                          {
                            term: "EntryCategoryTerm2",
                            label: "EntryCategoryLabel2"
                          }
                        ],
                        content: {
                          type: "xhtml",
                          text: "<div><p>My entry content</p></div>"
                        }
                    },
                    feed: {
                        title: {
                          type: "text",
                          text: "My Awesome Feed Title"
                        },
                        updated: "2005-07-31T12:29:29Z",
                        id: "tag:example.org,2003:3",
                        links: [
                          {
                            href: "http://example.org/",
                            rel: "alternate",
                            type: "text/html",
                            hreflang: "en"
                          },
                          {
                            href: "http://example.org/feed.atom",
                            rel: "self",
                            type: "application/atom+xml"
                          }
                        ],
                        rights: {
                          text: "Copyright (c) 2003, Craig Bailey"
                        },
                        generator: {
                          uri: "http://www.example.com/",
                          version: "1.0"
                        },
                        categories: [
                          {
                            term: "FeedCategoryTerm1",
                            label: "FeedCategoryLabel1"
                          },
                          {
                            term: "FeedCategoryTerm2",
                            label: "FeedCategoryLabel2"
                          }
                        ],
                        author: {
                          name: "Craig Bailey",
                          uri: "Craig Bailey",
                          email: "f8dy@example.com"
                        },
                        contributors: [
                          {
                            name: "John Doe",
                            uri: "John Doe"
                          },
                          {
                            name: "Jane Doe",
                            uri: "Jane Doe"
                          }
                        ]
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
                    S: "my-awesome-entry-1"
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
                        title: "Something very important has happened",
                        link: "http://www.example.com/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission",
                        description: "This is a very informative item. Wow. Amazing",
                        enclosure: {
                          url: "http://www.example.com/sites/default/files/styles/1x1_cardfeed/public/thumbnails/image/escapade.jpeg?itok=4RKUBjZp",
                          length: "70814",
                          type: "image/jpeg"
                        },
                        guid: "http://www.example.com/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission",
                        pubDate: "Thu, 09 Feb 2023 16:45 EST",
                        source: {
                          name: "Breaking News",
                          url: "http://www.example.com/rss/dyn/breaking_news.rss"
                        }
                    },
                    feed: {
                        title: "Breaking News",
                        description: "A RSS news feed containing the latest news",
                        link: "http://www.example.com/",
                        language: "en-us",
                        category: [ "carrot", "egg" ],
                        image: {
                          url: "https://www.example.com/images/logo.gif",
                          title: "example.com",
                          link: "https://www.example.com"
                        },
                        managingEditor: "john.doe@example.com",
                        webMaster: "jane.doe@example.com",
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
                        title: "Something very important has happened",
                        link: "http://www.example.com/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission",
                        description: "This is a very informative item. Wow. Amazing",
                        enclosure: {
                        url: "http://www.example.com/sites/default/files/styles/1x1_cardfeed/public/thumbnails/image/escapade.jpeg?itok=4RKUBjZp",
                        length: "70814",
                        type: "image/jpeg"
                        },
                        guid: "http://www.example.com/press-release/nasa-selects-blue-origin-to-launch-mars-magnetosphere-study-mission",
                        pubDate: "Thu, 09 Feb 2023 16:45 EST",
                        source: {
                            name: "Breaking News",
                            url: "http://www.example.com/rss/dyn/breaking_news.rss"
                        }
                    },
                    feed: {
                        title: "Breaking News",
                        description: "A RSS news feed containing the latest news",
                        link: "http://www.example.com/",
                        language: "en-us",
                        category: [ "carrot", "egg" ],
                        image: {
                        url: "https://www.example.com/images/logo.gif",
                        title: "example.com",
                        link: "https://www.example.com"
                        },
                        managingEditor: "john.doe@example.com",
                        webMaster: "jane.doe@example.com",
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