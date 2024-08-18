# web-feed-aws-events




## Table Schema

### Sources Table

| Attribute           | Type                | Description                                                                                    |
| ------------------- |:--------------------| :----------------------------------------------------------------------------------------------|
| source              | String              | An HTTP/S URL for the feed                                                                     |
| type                | String              | The feed type (ATOM or RSS)                                                                    |
| httpHeaderOverrides | Map<String, String> | A map of HTTP headers to set when making a<br>request to retrieve content from the source      |

### Items Table

| Attribute      | Type                | Description                                                                                    |
| ---------------|:--------------------| :----------------------------------------------------------------------------------------------|
| source         | String              | The URL of the feed                                                                            |
| id 		     | String              | The unique ID of the channel item                                                              |



## Event Format

### RSS

#### Feed Properties

- **title** *(string)* - The name of the channel
- **link** *(string)* - The URL to the HTML website corresponding to the channel
- **description** *(string)* - Phrase or sentence describing the channel 
- **categories** *(array&lt;string&gt;)* - An array of categories that the channel belongs to
- **language** *(string)* - The language the channel is written in
- **copyright** *(string)* - Copyright notice for content in the channel
- **managingEditor** *(string)* - Email address for person responsible for editorial content
- **webMaster** *(string)* - Email address for person responsible for technical issues relating to channel
- **pubDate** *(string)* - The publication date for the content in the channel
- **lastBuildDate** *(string)* - The last time the content of the channel changed
- **generator** *(string)* - A string indicating the program used to generate the channel
- **docs** *(string)* - A URL that points to the documentation for the format used in the RSS file
- **cloud** *(object)* - Allows processes to register with a cloud to be notified of updates to the channel, implementing a lightweight publish-subscribe protocol for RSS feeds
- **ttl** *(number)* - Number of minutes that indicates how long a channel can be cached before refreshing from the source
- **image** *(object)* - Specifies a GIF, JPEG or PNG image that can be displayed with the channel
    - **url** *(string)* - The URL of a GIF, JPEG or PNG image that represents the channel
    - **title** *(string)* - Describes the image, it's used in the ALT attribute of the HTML &lt;img&gt; tag when the channel is rendered in HTML
    - **link** *(string)* -The URL of the site, when the channel is rendered, the image is a link to the site
    - **width** *(number)* - Width of the image
    - **height** *(number)* - Height of the image
- **rating** *(string)* - The [PICS](http://www.w3.org/PICS/) rating for the channel
- **textInput** *(object)* - Specifies a text input box that can be displayed with the channel
    - **title** *(string)* - The label of the Submit button in the text input area
    - **description** *(string)* - Explains the text input area
    - **name** *(string)* - The name of the text object in the text input area
    - **link** *(string)* - The URL of the CGI script that processes text input request
- **skipHours** *(array&lt;number&gt;)* - A hint for aggregators telling them which hours they can skip, which takes the form of an array that contains up to 24 numbers, between 0 and 23, that specify a time in GMT 
- **skipDays** *(array&lt;string&gt;)*- A hint for aggregators telling them which days they can skip, which takes the form of an array that contains up to seven strings, with possible values of:
    - *Monday*
    - *Tuesday*
    - *Wednesday*
    - *Thursday*
    - *Friday*
    - *Saturday*
    - *Sunday*


#### Item Properties

- **title** *(string)* - The title of the item
- **link** *(string)* - The URL of the item
- **description** *(string)* - The item synopsis
- **author** *(string)* - Email address of the author of the item
- **categories** *(array&lt;string&gt;)* - An array of categories that the item belongs to
- **comments** *(string)* - URL of a page for comments relating to the item
- **enclosure** *(object)* - Describes a media object that is attached to the item
    - **url** *(string)* - Where the enclosure is located
    - **length** *(number)* - How big the media object is
    - **type** *(string)* - The MIME type of the media object
- **guid** *(string)* - A string that uniquely identifies the item
- **pubDate** *(string)* - Indicates when the item was published
- **source** *(string)* - The RSS channel that the item came from


### ATOM

#### Feed Properties

- **id** *(string)* - Identifer of the feed
- **title** *(object)* - The title of the feed
    - **type** *(string)* - The type of text (text/html/xhtml)
    - **text** *(string)* - The text of the title
- **updated** *(string)* - The last time the feed was modified
- **authors** *(array&lt;object&gt;)* - The authors of the feed
    - **name** *(string)* - The name of the author
    - **email** *(number)* - The email address of the author
    - **uri** *(string)* - The home page for the author
- **links** *(array&lt;object&gt;)* - A related web page for the feed
    - **href** *(string)* - The URI of the resource
    - **rel** *(number)* - The link relationship type
    - **type** *(string)* - The media type of the resource
    - **hreflang** *(string)* - The language of the resource
    - **title** *(string)* - Display title of the link
    - **length** *(number)* - The size of the resource in bytes

