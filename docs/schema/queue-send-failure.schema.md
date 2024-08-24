# Queue Send Failure

*The event sent to EventBridge when an attempt to send a meessage to an SQS queue fails*

## Properties

- **`source`** *(string)*: Must be: `"dlq"`.
- **`detail-type`** *(string)*: The event type, which denotes which queue has the failure. Must be one of: `["FEED_QUEUE_SEND_FAILURE", "ITEM_QUEUE_SEND_FAILURE"]`.
- **`detail`** *(object)*: Description of the SQS message send failure. Copied from this [documentation](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_BatchResultErrorEntry.html).
  - **`Code`** *(string)*: An error code representing why the action failed on this entry.
  - **`Id`** *(string)*: The Id of an entry in a batch request.
  - **`SenderFault`** *(string)*: Specifies whether the error happened due to the caller of the batch API action.
  - **`Message`** *(string)*: A message explaining why the action failed on this entry.
