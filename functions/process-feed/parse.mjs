import { XMLParser } from "fast-xml-parser";
import { default as axiosStatic } from 'axios';
import { minify } from "html-minifier";

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
            "feed.entry",
            "feed.entry.category",
            "feed.entry.link",
            "feed.entry.contributor",
            "feed.category",
            "feed.contributor",
            "feed.link"
        ].includes(jpath);
    },
    stopNodes: ["feed.entry.content"]
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
    const httpResponse = await axiosStatic.get(source, httpRequestConfig);
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
                for(const entryElement of propertyValue){
                    const item = {};
                    for(const [itemProperyName, itemPropertyValue] of Object.entries(entryElement)){
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
                                else{
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
                }
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

    function parseAtomPerson(person){
        return {
            name: person.name,
            uri: person.name,
            email: person.email
        };
    }

    function parseAtomCategory(category){
        return {
            term: category['@_term'],
            scheme: category['@_scheme'],
            label: category['@_label']
        };
    }

    function parseAtomLink(link){
        return {
            href: link['@_href'],
            rel: link['@_rel'],
            type: link['@_type'],
            hreflang: link['@_hreflang'],
            title: link['@_title'],
            length: link['@_length']
        };
    }

    function parseAtomContent(content){
        if(typeof content === "object" && content["#text"]){
            return {
                src: content['@_src'],
                type: content['@_type'],
                text: minifyText(content['@_type'], content['#text'])
            }
        }
        else if(typeof content === "string"){
            return {
                text: content
            }
        }
    }

    function minifyText(type, text){
        return type.includes("html") ? minify(text, {
            collapseWhitespace: true
        }) : text;
    }

    const feedProperties = {};
    const items = [];
    const httpRequestConfig = {};
    if(headers){
        httpRequestConfig.headers = headers;
    }
    const httpResponse = await axiosStatic.get(source, httpRequestConfig);
    const parsed = atomXmlParser.parse(httpResponse.data);
    // Fill in supported feed properties
    for(const [properyName, propertyValue] of Object.entries(parsed.feed)){
        switch(properyName){
            case "id":
            case "updated":
            case "icon":
            case "logo": 
                feedProperties[properyName] = propertyValue;
                break;
            case "author":
                feedProperties[properyName] = parseAtomPerson(propertyValue);
                break;
            case "link":
                feedProperties.links = propertyValue.map(parseAtomLink);
                break;
            case "category":
                feedProperties.categories = propertyValue.map(parseAtomCategory);
                break;
            case "contributor":
                feedProperties.contributors = propertyValue.map(parseAtomPerson);
                break;
            case "generator":
                feedProperties.generator = {
                    uri: propertyValue['@_uri'],
                    version: propertyValue['@_version']
                };
                break;
            case "title":
            case "rights": 
            case "subtitle":
                feedProperties[properyName] = parseAtomContent(propertyValue);
                break;
            case "entry":
                for(const entryElement of propertyValue){
                    const entry = {};
                    for(const [entryProperyName, entryPropertyValue] of Object.entries(entryElement)){
                        switch(entryProperyName){
                            case "id":
                            case "updated":
                            case "published":
                                entry[entryProperyName] = entryPropertyValue;
                                break;
                            case "title":
                            case "rights": 
                            case "summary":
                                entry[entryProperyName] = parseAtomContent(entryPropertyValue);
                                break;
                            case "author":
                                entry[entryProperyName] = parseAtomPerson(entryPropertyValue);
                                break;
                            case "link":
                                entry.links = entryPropertyValue.map(parseAtomLink);
                                break;
                            case "category":
                                entry.categories = entryPropertyValue.map(parseAtomCategory);
                                break;
                            case "contributor":
                                entry.contributors = entryPropertyValue.map(parseAtomPerson);
                                break;
                            case "source":
                                entry.source = {
                                    id: entryPropertyValue['@_id'],
                                    title: entryPropertyValue['@_title'],
                                    updated: entryPropertyValue['@_updated']
                                };
                                break;
                            case "content":
                                entry.content = parseAtomContent(entryPropertyValue);
                                break;
                            default:
                                break;
                        }
                    }
                    items.push(entry);
                }
                break;
            default:
                break;
        }
    }   
    return [feedProperties, items];
}
