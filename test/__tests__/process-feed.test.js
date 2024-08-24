import {describe, expect, test, jest} from '@jest/globals';
import {mockClient} from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import 'jest-json';
import '@testing-library/jest-dom'
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
    process.env.ITEM_DELAY = "1";
}

let dynamodbMock = mockClient(DynamoDBClient),
    sqsMock = mockClient(SQSClient);

const expectedAtomSqsMessage1 = JSON.parse(readFileSync("test/files/atom-1-sqsmessage.json"));
const expectedRssSqsMessage1 = JSON.parse(readFileSync("test/files/rss-1-sqsmessage.json"));

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

  test('Invalid feed type', async () => {
      const event = {
          Records: [{
              messageId: "mock-message-id",
              receiptHandle: "mock-receipt-handle",
              attributes: {},
              body: JSON.stringify({
                  source: "https://mock-source.com",
                  type: "?"
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
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenNthCalledWith(1, "Message ID: mock-message-id", expect.any(Error));
      expect(errorSpy.mock.calls[0][1].message).toEqual("Unrecognized feed type '?'");
      expect(caughtError.message).toEqual("At least one or more SQS messages failed to process");
      expect(dynamodbMock).not.toHaveReceivedCommand(QueryCommand);
      expect(dynamodbMock).not.toHaveReceivedCommand(BatchWriteItemCommand);
      expect(sqsMock).not.toHaveReceivedCommand(SendMessageBatchCommand);
      expect(sqsMock).not.toHaveReceivedCommand(DeleteMessageCommand);
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
        expect(axios.get).toHaveBeenCalledWith("https://mock-source.com", {});
        expect(dynamodbMock).toHaveReceivedCommandTimes(QueryCommand, 1);
        expect(dynamodbMock).toHaveReceivedCommandWith(QueryCommand, {
            TableName: "mockdynamodbtable",
            ExpressionAttributeNames: {
                "#S": "source",
                "#G": "id"
            },
            ExpressionAttributeValues: {
                ":source" : {
                    "S" : "https://mock-source.com"
                }
            },
            KeyConditionExpression : "#S = :source",
            ProjectionExpression: "#G" 
        });
        expect(dynamodbMock).not.toHaveReceivedCommand(BatchWriteItemCommand);
        expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
        expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
          QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockFeedQueue",
          ReceiptHandle: "mock-receipt-handle"
        });
        expect(sqsMock).toHaveReceivedCommandTimes(SendMessageBatchCommand, 1);
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageBatchCommand, {
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockItemQueue",  
            Entries: [{
                Id: expect.any(String),
                MessageBody: expect.jsonMatching(expectedAtomSqsMessage1),
                DelaySeconds: 1
            }]
        });
  });

  test('ATOM feed fetched using HTTP headers', async () => {
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
                  type: "ATOM",
                  headers: {
                    "X-Custom-Header": "CustomHeaderValue"
                  }
              })
          }]
      };
      await handler(event);
      expect(axios.get).toHaveBeenCalledWith("https://mock-source.com", {headers: {"X-Custom-Header": "CustomHeaderValue"}});
      expect(dynamodbMock).toHaveReceivedCommandTimes(QueryCommand, 1);
      expect(dynamodbMock).toHaveReceivedCommandWith(QueryCommand, {
          TableName: "mockdynamodbtable",
          ExpressionAttributeNames: {
              "#S": "source",
              "#G": "id"
          },
          ExpressionAttributeValues: {
              ":source" : {
                  "S" : "https://mock-source.com"
              }
          },
          KeyConditionExpression : "#S = :source",
          ProjectionExpression: "#G" 
      });
      expect(dynamodbMock).not.toHaveReceivedCommand(BatchWriteItemCommand);
      expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
      expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
        QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockFeedQueue",
        ReceiptHandle: "mock-receipt-handle"
      });
      expect(sqsMock).toHaveReceivedCommandTimes(SendMessageBatchCommand, 1);
      expect(sqsMock).toHaveReceivedCommandWith(SendMessageBatchCommand, {
          QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockItemQueue",
          Entries: [{
              Id: expect.any(String),
              MessageBody: expect.jsonMatching(expectedAtomSqsMessage1),
              DelaySeconds: 1
          }]
      });
  }); 

  test('RSS feed processed', async () => {
    sqsMock.on(DeleteMessageCommand).resolvesOnce({});
    sqsMock.on(SendMessageBatchCommand).resolvesOnce({});
    dynamodbMock.on(QueryCommand).resolvesOnce({
        Count: 0,
        Items: []
    });
    const rssContent = readFileSync("test/files/rss-1.rss", {encoding: "utf-8"});
    axios.get.mockResolvedValueOnce({
        data: rssContent
    });
    const event = {
        Records: [{
            messageId: "mock-message-id",
            receiptHandle: "mock-receipt-handle",
            attributes: {},
            body: JSON.stringify({
                source: "https://mock-source.com",
                type: "RSS"
            })
        }]
    };
    await handler(event);
    expect(axios.get).toHaveBeenCalledWith("https://mock-source.com", {});
    expect(dynamodbMock).toHaveReceivedCommandTimes(QueryCommand, 1);
    expect(dynamodbMock).toHaveReceivedCommandWith(QueryCommand, {
        TableName: "mockdynamodbtable",
        ExpressionAttributeNames: {
            "#S": "source",
            "#G": "id"
        },
        ExpressionAttributeValues: {
            ":source" : {
                "S" : "https://mock-source.com"
            }
        },
        KeyConditionExpression : "#S = :source",
        ProjectionExpression: "#G" 
    });
    expect(dynamodbMock).not.toHaveReceivedCommand(BatchWriteItemCommand);
    expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
    expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockFeedQueue",
      ReceiptHandle: "mock-receipt-handle"
    });
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageBatchCommand, 1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageBatchCommand, {
        QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockItemQueue",  
        Entries: [{
            Id: expect.any(String),
            MessageBody: expect.jsonMatching(expectedRssSqsMessage1),
            DelaySeconds: 1
        }]
    });
  });

  test('RSS feed fetched using HTTP headers', async () => {
    sqsMock.on(DeleteMessageCommand).resolvesOnce({});
    sqsMock.on(SendMessageBatchCommand).resolvesOnce({});
    dynamodbMock.on(QueryCommand).resolvesOnce({
        Count: 0,
        Items: []
    });
    const rssContent = readFileSync("test/files/rss-1.rss", {encoding: "utf-8"});
    axios.get.mockResolvedValueOnce({
        data: rssContent
    });
    const event = {
        Records: [{
            messageId: "mock-message-id",
            receiptHandle: "mock-receipt-handle",
            attributes: {},
            body: JSON.stringify({
                source: "https://mock-source.com",
                type: "RSS",
                headers: {
                  "X-Custom-Header": "CustomHeaderValue"
                }
            })
        }]
    };
    await handler(event);
    expect(axios.get).toHaveBeenCalledWith("https://mock-source.com", {headers: {
      "X-Custom-Header": "CustomHeaderValue"
    }});
    expect(dynamodbMock).toHaveReceivedCommandTimes(QueryCommand, 1);
    expect(dynamodbMock).toHaveReceivedCommandWith(QueryCommand, {
        TableName: "mockdynamodbtable",
        ExpressionAttributeNames: {
            "#S": "source",
            "#G": "id"
        },
        ExpressionAttributeValues: {
            ":source" : {
                "S" : "https://mock-source.com"
            }
        },
        KeyConditionExpression : "#S = :source",
        ProjectionExpression: "#G" 
    });
    expect(dynamodbMock).not.toHaveReceivedCommand(BatchWriteItemCommand);
    expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
    expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockFeedQueue",
      ReceiptHandle: "mock-receipt-handle"
    });
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageBatchCommand, 1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageBatchCommand, {
        QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockItemQueue",  
        Entries: [{
            Id: expect.any(String),
            MessageBody: expect.jsonMatching(expectedRssSqsMessage1),
            DelaySeconds: 1
        }]
    });
  });

  test('Fail to send SQS message for item', async () => {
    sqsMock.on(DeleteMessageCommand).resolvesOnce({});
    sqsMock.on(SendMessageBatchCommand)
      .resolvesOnce({
        Failed: [{
          Id: "mock-failed-id",
          Code: "NEEDS_MORE_COWBELL",
          SenderFault: true,
          Message: "Oopsie"
        }]
      })
      .resolvesOnce({});
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
    expect(axios.get).toHaveBeenCalledWith("https://mock-source.com", {});
    expect(dynamodbMock).toHaveReceivedCommandTimes(QueryCommand, 1);
    expect(dynamodbMock).toHaveReceivedCommandWith(QueryCommand, {
        TableName: "mockdynamodbtable",
        ExpressionAttributeNames: {
            "#S": "source",
            "#G": "id"
        },
        ExpressionAttributeValues: {
            ":source" : {
                "S" : "https://mock-source.com"
            }
        },
        KeyConditionExpression : "#S = :source",
        ProjectionExpression: "#G" 
    });
    expect(dynamodbMock).not.toHaveReceivedCommand(BatchWriteItemCommand);
    expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
    expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockFeedQueue",
      ReceiptHandle: "mock-receipt-handle"
    });
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageBatchCommand, 2);
    expect(sqsMock).toHaveReceivedNthCommandWith(1, SendMessageBatchCommand, {
        QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockItemQueue",
        Entries: [{
            Id: expect.any(String),
            MessageBody: expect.jsonMatching(expectedAtomSqsMessage1),
            DelaySeconds: 1
        }]
    });
    expect(sqsMock).toHaveReceivedNthCommandWith(2, SendMessageBatchCommand, {
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockDeadLetterQueue",
      Entries: [{
        Id: expect.any(String),
        MessageBody: expect.jsonMatching({
            type: "ITEM_QUEUE_SEND_FAILURE",
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
    expect(errorSpy).toHaveBeenNthCalledWith(1, "Failed to send SQS message:", expect.jsonMatching({
      Id: "mock-failed-id",
      Code: "NEEDS_MORE_COWBELL",
      SenderFault: true,
      Message: "Oopsie"
    }));
  }); 

  test('Feed contains no new items', async () => {
    sqsMock.on(DeleteMessageCommand).resolvesOnce({});
    sqsMock.on(SendMessageBatchCommand).resolvesOnce({});
    dynamodbMock.on(QueryCommand).resolvesOnce({
        Count: 1,
        Items: [{
          source: {
            S: "https://mock-source.com"
          },
          id: {
            S: "my-awesome-entry-1"
          }
        }]
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
    expect(axios.get).toHaveBeenCalledWith("https://mock-source.com", {});
    expect(dynamodbMock).toHaveReceivedCommandTimes(QueryCommand, 1);
    expect(dynamodbMock).toHaveReceivedCommandWith(QueryCommand, {
        TableName: "mockdynamodbtable",
        ExpressionAttributeNames: {
            "#S": "source",
            "#G": "id"
        },
        ExpressionAttributeValues: {
            ":source" : {
                "S" : "https://mock-source.com"
            }
        },
        KeyConditionExpression : "#S = :source",
        ProjectionExpression: "#G" 
    });
    expect(dynamodbMock).not.toHaveReceivedCommand(BatchWriteItemCommand);
    expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
    expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockFeedQueue",
      ReceiptHandle: "mock-receipt-handle"
    });
    expect(sqsMock).not.toHaveReceivedCommand(SendMessageBatchCommand);
  }); 

  test('Feed items must be deleted', async () => {
    sqsMock.on(DeleteMessageCommand).resolvesOnce({});
    sqsMock.on(SendMessageBatchCommand).resolvesOnce({});
    dynamodbMock.on(QueryCommand).resolvesOnce({
      Count: 1,
      Items: [{
        source: {
          S: "https://mock-source.com"
        },
        id: {
          S: "my-awesome-entry-2"
        }
      }]
    });
    dynamodbMock.on(BatchWriteItemCommand).resolvesOnce({});
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
    expect(axios.get).toHaveBeenCalledWith("https://mock-source.com", {});
    expect(dynamodbMock).toHaveReceivedCommandTimes(QueryCommand, 1);
    expect(dynamodbMock).toHaveReceivedCommandWith(QueryCommand, {
        TableName: "mockdynamodbtable",
        ExpressionAttributeNames: {
            "#S": "source",
            "#G": "id"
        },
        ExpressionAttributeValues: {
            ":source" : {
                "S" : "https://mock-source.com"
            }
        },
        KeyConditionExpression : "#S = :source",
        ProjectionExpression: "#G" 
    });
    expect(dynamodbMock).toHaveReceivedCommandTimes(BatchWriteItemCommand, 1);
    expect(dynamodbMock).toHaveReceivedCommandWith(BatchWriteItemCommand, {
      RequestItems: {
        "mockdynamodbtable": [{
          DeleteRequest: {
            Key: {
              source: {
                S: "https://mock-source.com"
              },
              id: {
                S: "my-awesome-entry-2"
              }
            }
          }
        }]
      }
    });
    expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
    expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockFeedQueue",
      ReceiptHandle: "mock-receipt-handle"
    });
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageBatchCommand, 1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageBatchCommand, {
        QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockItemQueue",
        Entries: [{
            Id: expect.any(String),
            MessageBody: expect.jsonMatching(expectedAtomSqsMessage1),
            DelaySeconds: 1
        }]
    });
  });

  test('Multiple feed items must be deleted', async () => {
    sqsMock.on(DeleteMessageCommand).resolvesOnce({});
    sqsMock.on(SendMessageBatchCommand).resolvesOnce({});
    dynamodbMock.on(QueryCommand).resolvesOnce({
      Count: 1,
      Items: [{
        source: {
          S: "https://mock-source.com"
        },
        id: {
          S: "my-awesome-entry-2"
        }
      }],
      LastEvaluatedKey: {
        source: {
          S: "https://mock-source.com"
        },
        id: {
          S: "my-awesome-entry-2"
        }
      }
    })
    .resolvesOnce({
      Count: 1,
      Items: [{
        source: {
          S: "https://mock-source.com"
        },
        id: {
          S: "my-awesome-entry-3"
        }
      }]
    });
    dynamodbMock.on(BatchWriteItemCommand).resolvesOnce({});
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
    expect(axios.get).toHaveBeenCalledWith("https://mock-source.com", {});
    expect(dynamodbMock).toHaveReceivedCommandTimes(QueryCommand, 2);
    expect(dynamodbMock).toHaveReceivedNthCommandWith(1, QueryCommand, {
        TableName: "mockdynamodbtable",
        ExpressionAttributeNames: {
            "#S": "source",
            "#G": "id"
        },
        ExpressionAttributeValues: {
            ":source" : {
                "S" : "https://mock-source.com"
            }
        },
        KeyConditionExpression : "#S = :source",
        ProjectionExpression: "#G" 
    });
    expect(dynamodbMock).toHaveReceivedNthCommandWith(2, QueryCommand, {
      TableName: "mockdynamodbtable",
      ExpressionAttributeNames: {
          "#S": "source",
          "#G": "id"
      },
      ExpressionAttributeValues: {
          ":source" : {
              "S" : "https://mock-source.com"
          }
      },
      KeyConditionExpression : "#S = :source",
      ProjectionExpression: "#G",
      ExclusiveStartKey: {
        source: {
          S: "https://mock-source.com"
        },
        id: {
          S: "my-awesome-entry-2"
        }
      }
    });
    expect(dynamodbMock).toHaveReceivedCommandTimes(BatchWriteItemCommand, 1);
    expect(dynamodbMock).toHaveReceivedCommandWith(BatchWriteItemCommand, {
      RequestItems: {
        "mockdynamodbtable": [{
          DeleteRequest: {
            Key: {
              source: {
                S: "https://mock-source.com"
              },
              id: {
                S: "my-awesome-entry-2"
              }
            }
          }
        },
        {
          DeleteRequest: {
            Key: {
              source: {
                S: "https://mock-source.com"
              },
              id: {
                S: "my-awesome-entry-3"
              }
            }
          }
        }
      ]}
    });
    expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
    expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockFeedQueue",
      ReceiptHandle: "mock-receipt-handle"
    });
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageBatchCommand, 1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageBatchCommand, {
        QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockItemQueue",
        Entries: [{
            Id: expect.any(String),
            MessageBody: expect.jsonMatching(expectedAtomSqsMessage1),
            DelaySeconds: 1
        }]
    });
  });

  test('Feed items fail to be deleted', async () => {
    sqsMock.on(DeleteMessageCommand).resolvesOnce({});
    sqsMock.on(SendMessageBatchCommand).resolvesOnce({});
    dynamodbMock.on(QueryCommand).resolvesOnce({
      Count: 1,
      Items: [{
        source: {
          S: "https://mock-source.com"
        },
        id: {
          S: "my-awesome-entry-2"
        }
      }]
    });
    dynamodbMock.on(BatchWriteItemCommand).resolves({
      UnprocessedItems: {
        "mockdynamodbtable": [{
          DeleteRequest: {
            Key: {
              source: {
                S: "https://mock-source.com"
              },
              id: {
                S: "my-awesome-entry-2"
              }
            }
          }
        }]
      }
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
    expect(axios.get).toHaveBeenCalledWith("https://mock-source.com", {});
    expect(dynamodbMock).toHaveReceivedCommandTimes(QueryCommand, 1);
    expect(dynamodbMock).toHaveReceivedCommandWith(QueryCommand, {
        TableName: "mockdynamodbtable",
        ExpressionAttributeNames: {
            "#S": "source",
            "#G": "id"
        },
        ExpressionAttributeValues: {
            ":source" : {
                "S" : "https://mock-source.com"
            }
        },
        KeyConditionExpression : "#S = :source",
        ProjectionExpression: "#G" 
    });
    expect(dynamodbMock).toHaveReceivedCommandTimes(BatchWriteItemCommand, 5);
    expect(dynamodbMock).toHaveReceivedCommandWith(BatchWriteItemCommand, {
      RequestItems: {
        "mockdynamodbtable": [{
          DeleteRequest: {
            Key: {
              source: {
                S: "https://mock-source.com"
              },
              id: {
                S: "my-awesome-entry-2"
              }
            }
          }
        }]
      }
    });
    expect(sqsMock).toHaveReceivedCommandTimes(DeleteMessageCommand, 1);
    expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockFeedQueue",
      ReceiptHandle: "mock-receipt-handle"
    });
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageBatchCommand, 1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageBatchCommand, {
        QueueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MockItemQueue",
        Entries: [{
            Id: expect.any(String),
            MessageBody: expect.jsonMatching(expectedAtomSqsMessage1),
            DelaySeconds: 1
        }]
    });
  });
});