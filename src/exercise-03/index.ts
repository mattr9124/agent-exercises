import {query, type AgentDefinition} from "@anthropic-ai/claude-agent-sdk";
import {logMessage} from "../shared/log.ts";
import * as readLine from "node:readline/promises";
import {stdin as input, stdout as output} from "node:process";

const MODEL = 'claude-sonnet-5';
const LIGHT_MODEL = 'claude-haiku-5-5';
const MAX_TURNS = 10;

const line_reader = readLine.createInterface({input, output})
let userInput: string = await line_reader.question('You: ');

for await (const message of query({
    prompt: userInput,
    options: {
        model: MODEL,
        maxTurns: MAX_TURNS,
        systemPrompt: `
        You are a coordinator agent in a hub and spoke system. You will receive request for information
        and should pass off to subagents in parallel to search the web about a topic. 
        Start websearch (one per query) and document_analyzer in the same response, since they are independent. 
        Once all of them have returned, call synthesis with every finding and its metadata. 
        
        Once all searches and analysis are complete, use the synthesis subagent to create a summary. This should
        of course not run in parallel but after the other subagents complete.
        
        The subagents need context, provide the subagents with correct metadata. The document analyzer needs 
        to know the source URL of each document in order to make correct citations.
        
        The synthesis agent needs to know of all the metadata the document analyzer returns. 
        
        `,
        settings: {autoMemoryEnabled: false},
        settingSources: [],
        allowedTools: ["Task", "WebFetch"],
        agents: {
            websearch: {
                description: 'Returns search results with source URLs and titles',
                prompt: `You are a subagent and your task is to run a websearch and return results
                including the source URL and the title of the page. 
                
                Only include actual search results and not invented ones based on your own knowledge.
                If you are unable to search for any reason report back an error and reason.
                
                Your output should be structured as follows:
                [{
                    title: <title of the result>,
                    url: <source url>
                    content: <result content>
                }]
                `,
                tools: ["WebFetch"],
                model: LIGHT_MODEL
            },
            document_analyzer: {
                description: `Analyze pages and return results with page references
                
                Input format should include the title, url and content in a format like so:
                
                {
                    title: <title of the result>,
                    url: <source url>
                    content: <result content>
                }
                
                `,
                prompt: `You are a subagent and your task is to analyze pages or documents for a specific request
                Your analysis should include page references to where you got the data from.
                
                Only include actual data from the document analyzed and do not invent data based on your own knowledge.
                
                Your output should be structured as follows:
                [{
                    claim: <some finding>,
                    analysis: <more detailed analysis>,
                    metadata: {
                        source_url: <url>,
                        document_name: <name>,
                        page_number: <page number>,
                        confidence: <how confident are you about the finding>,
                        retrieved_by: 'document_analyzer'                      
                    }    
                }]
                `,
                tools: ["Read"]
            },
            synthesis: {
                description: 'Builds a summary of the documents analyzed with claims and attributions',
                prompt: `You are a subagent and your task is to summarize the analysis you receive as input
                Your summary should include citations of the claims and attributions.
                
                Your summary should include only data that you receive as input and nothing else!                 
                `,
                tools: []
            }
        }
    }
})) {
    logMessage(message);
}


line_reader.close();