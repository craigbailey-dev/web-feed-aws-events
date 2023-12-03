import { XMLParser } from "fast-xml-parser";

// Axios HTTP/S client
const feedHttpClient = new Axios();

// XML parsers
const rssXmlParser = new XMLParser({
    ignoreAttributes: false,
    isArray: (name, jpath, isLeafNode, isAttribute) => {
        return [
            "rss.channel.item", 
            "rss.channel.item.category",
            "rss.channel.category",
            "rss.channel.skipHours.hour",
            "rss.channel.skipDays.day"
        ].includes(jpath);
    }
});

const atomXmlParser = new XMLParser({
    ignoreAttributes: false,
    isArray: (name, jpath, isLeafNode, isAttribute) => {
        return [
            "feed.entry"
        ].includes(jpath);
    }
});

/**
 * Fetches the RSS feed from the source URL and parses the XML
 * @param {string} source The source URL
 * @param {{[name: string]: string}} headers Headers to include in the HTTP/S request to retrieve the RRS feed XML
 * @returns The properties of the feed and the items in the feed
 */
export async function fetchRssItems(source, headers){
    const feedProperties = {};
    const items = [];
    const httpRequestConfig = {};
    if(headers){
        httpRequestConfig.headers = headers;
    }
    const httpResponse = await feedHttpClient.get(source, httpRequestConfig);
    const parsed = rssXmlParser.parse(httpResponse.data);

    // Fill in supported feed properties
    for(const [properyName, propertyValue] of Object.entries(parsed.rss.channel)){
        switch(properyName){
            case "title":
            case "link":
            case "description":
            case "language":
            case "copyright":
            case "managingEditor":
            case "webMaster":
            case "pubDate":
            case "lastBuildDate":
            case "generator":
            case "rating":
            case "docs":
            case "cloud":
                feedProperties[properyName] = propertyValue;
                break;
            case "category":
                feedProperties.categories = propertyValue;
                break;
            case "ttl":
                feedProperties[properyName] = parseInt(propertyValue);
                break;
            case "image":
                feedProperties.image = {};
                for(const [imageProperyName, imagePropertyValue] of Object.entries(propertyValue)){
                    switch(imageProperyName){
                        case "url":
                        case "title":
                        case "link":
                        case "description":
                            feedProperties.image[imageProperyName] = imagePropertyValue;
                            break;
                        case "width":
                        case "height":
                            feedProperties.image[imageProperyName] = parseInt(imagePropertyValue);
                        default:
                            break;
                    }
                }
            case "textInput":
                feedProperties.textInput = {
                    name: propertyValue.name,
                    title: propertyValue.title,
                    link: propertyValue.link,
                    description: propertyValue.description
                };
                break;
            case "skipHours":
                feedProperties.skipHours = propertyValue.hour.map(parseInt);
                break;
            case "skipDays":
                feedProperties.skipDays = propertyValue.day;
                break;
            case "item":
                const item = {};
                for(const [itemProperyName, itemPropertyValue] of Object.entries(propertyValue)){
                    switch(itemProperyName){
                        case "title":
                        case "link":
                        case "description":
                        case "author":
                        case "comments":
                        case "guid":
                        case "pubDate":
                            if(typeof itemPropertyValue === "object" && itemPropertyValue["#text"]){
                                item[itemProperyName] = itemPropertyValue["#text"];
                            }
                            else if(typeof itemPropertyValue === "string"){
                                item[itemProperyName] = itemPropertyValue
                            }
                            break;
                        case "enclosure":
                            item.enclosure = {
                                url: itemPropertyValue['@_url'],
                                length: itemPropertyValue['@_length'],
                                type: itemPropertyValue['@_type']
                            };
                            break;
                        case "source":
                            item.source = {
                                url: itemPropertyValue['@_url'],
                                name: itemPropertyValue['#text'],
                            };
                            break;
                        case "category":
                            item.categories = itemPropertyValue;
                            break;
                        default:
                            break;
                    }   
                }
                items.push(item);
                break;
            default:
                break;
        }
    }
    return [feedProperties, items];
}   

/**
 * Fetches the ATOM feed from the source URL and parses the XML
 * @param {string} source The source URL
 * @param {{[name: string]: string}} headers Headers to include in the HTTP/S request to retrieve the ATOM feed XML
 * @returns The properties of the feed and the items in the feed
 */
export async function fetchAtomItems(source, headers){
    const feedProperties = {};
    const items = [];
    const httpRequestConfig = {};
    if(headers){
        httpRequestConfig.headers = headers;
    }
    const httpResponse = await feedHttpClient.get(source, httpRequestConfig);
    const parsed = atomXmlParser.parse(httpResponse.data);
    // Fill in supported feed properties
    for(const [properyName, propertyValue] of Object.entries(parsed.feed)){
        switch(properyName){
            
            default:
                break;
        }
    }   
    return [feedProperties, items];
}
