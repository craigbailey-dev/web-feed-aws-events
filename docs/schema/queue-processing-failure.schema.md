# Queue Processing Failure

*The event sent to EventBridge when an SQS message was received, but was failed to be processed*

## Properties

- **`source`** *(string)*: Must be: `"dlq"`.
- **`detail-type`** *(string)*: The event type, which denotes which queue sent the message that failed to process. Must be one of: `["FEED_QUEUE_PROCESSING_FAILURE", "ITEM_QUEUE_PROCESSING_FAILURE"]`.
- **`detail`** *(object)*: The original SQS record received. Can refer to this example of [SQS records](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#example-standard-queue-message-event).
