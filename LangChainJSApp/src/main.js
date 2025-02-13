//Import statements for all the different chat models and their embeddings
import { OpenAIEmbeddings, ChatOpenAI, AzureChatOpenAI, AzureOpenAIEmbeddings } from "@langchain/openai";
import { ChatXAI } from "@langchain/xai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatFireworks } from "@langchain/community/chat_models/fireworks";
import { TogetherAI } from "@langchain/community/llms/togetherai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatCohere, CohereEmbeddings } from "@langchain/cohere";
import { ChatGroq } from "@langchain/groq";
import { MistralAI } from "@langchain/mistralai";
import { HfInference } from "@huggingface/inference";

import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { fetchRepoContentsFromUrl } from "./utils";

/**
 * Method to get the response from the LLM 
 * @param {*} context the context for the RAG process
 * @param {*} query the query asked by the user
 * @param {*} llm the llm to be used for the query
 * @returns returns the result of the query based on the context
 */
async function generateResponse(context, query, llm) {
    const promptTemplate = ChatPromptTemplate.fromTemplate(`
        You are an expert assistant answering questions related to the repository data pulled from a GitHub repository.
        Use the following context to answer the query:

        Context:
        {context}

        Query:
        {query}

        Provide a detailed, accurate response based on the context provided.
        If you're unsure about something, please say so.
        
        Answer:
    `);

    const chain = RunnableSequence.from([
        promptTemplate,
        llm,
    ]);

    const response = await chain.invoke({
        context,
        query,
    });

    return response.content;
}


/**
 * Method to pull content from the repository and answer the query
 */
export async function pullFromRepo(){
    let files = [];
    const githubToken = document.getElementById('githubToken').value;
    const repoUrl = document.getElementById('sourceUrl').value;
    const apiKey = document.getElementById('apiKey').value;
    const chosenService = document.getElementById("aiModel").value;
    let llm;
    let embeddings;
    let needOtherAPIKey = false;
    let chosenLLM;
    let huggingface = false;

    switch(chosenService){
        case "OpenAI":
            //Need OpenAI Api Key
            chosenLLM = document.getElementById("openAIModel").value;
            llm = new ChatOpenAI({
                model: "gpt-4o-mini",
                temperature: 0,
                apiKey: apiKey
            });
            embeddings = new OpenAIEmbeddings({
                model: "text-embedding-3-small",
                apiKey: apiKey
            });
            break;
        case "Anthropic":
            llm = new ChatAnthropic({
                model: "claude-3-5-sonnet-20240620",
                apiKey: apiKey
            });
            //Need another API key for embedding
            needOtherAPIKey = true;
            break;
        case "Azure":
            llm = new AzureChatOpenAI({
                model: "gpt-4o",
                temperature: 0,
                azureOpenAIApiKey: apiKey
            });
            embeddings = new AzureOpenAIEmbeddings({
                azureOpenAIApiEmbeddingsDeploymentName: "text-embedding-ada-002"
            });
            break;
        case "Google":
            llm = new ChatGoogleGenerativeAI({
                model: "gemini-1.5-pro",
                temperature: 0,
                apiKey: apiKey
            });
            //Need another API key for embedding
            needOtherAPIKey = true;
            break;
        case "Cohere":
            llm = new ChatCohere({
                model: "command-r-plus",
                temperature: 0,
                apiKey: apiKey
            });
            embeddings = new CohereEmbeddings({
                model: "embed-english-v3.0"
            });
            break;
        case "FireworksAI":
            llm = new ChatFireworks({
                model: "accounts/fireworks/models/llama-v3p1-70b-instruct",
                temperature: 0,
                apiKey: apiKey
            });
            //Need another API key for embedding
            needOtherAPIKey = true;
            break;
        case "Groq":
            llm = new ChatGroq({
                model:"mixtral-8x7b-32768",
                temperature: 0,
                apiKey: apiKey
            });
            //Need another API key for embedding
            needOtherAPIKey = true;
            break;
        case "MistralAI":
            llm = new MistralAI({
                model: "codestral-latest",
                temperature: 0,
                apiKey: apiKey
            });
            //Need another API key for embedding
            needOtherAPIKey = true;
            break;
        //This is a langchian community LLM
        case "TogetherAI":
            llm = new TogetherAI({
                model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
                maxTokens: 256,
                apiKey: apiKey
            });
            needOtherAPIKey = true;
        case "HuggingFace":
            llm = new HfInference({
                apiKey: apiKey,
            });
            needOtherAPIKey = true;
            huggingface = true;
        default:
            console.log("Invalid LLM model selected");
    }

    //Instantiate the embedding model if the LLM requires a different API key
    if(needOtherAPIKey){
        const otherAPIKey = document.getElementById('otherApiKey').value;
        embeddings = new OpenAIEmbeddings({
            model: "text-embedding-3-small",
            apiKey: otherAPIKey
        });
    }

    const vectorStore = new MemoryVectorStore(embeddings);

    try{
        const urlType = document.getElementById('sourceType').value;
        const contents = await fetchRepoContentsFromUrl(repoUrl, urlType);
        console.log("Contents:", contents);
        // Run the documents through the splitter
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize:2000,
            chunkOverlap:200
        });

        const allSplits = await splitter.splitDocuments(contents);
        console.log("Splitted Documents:", allSplits);
        // Add documents to vector store directly without separate embedding step
        await vectorStore.addDocuments(allSplits);

        const query = document.getElementById('userQuery').value;

        const topMatches = await vectorStore.similaritySearch(query, 3);
        console.log("Top matches:", topMatches);
        const context = topMatches.map((doc, i) => `Source ${i + 1}: ${doc.metadata.source}\n${doc.pageContent}`).join("\n\n");
        console.log("Context:", context);
        console.log("Query:", query);
        let answer = "";
        if(!huggingface){
            answer = await generateResponse(context, query, llm);
        } else{
            //Handle the hugging face inference here
            answer = "";
            for await (const output of llm.textGenerationStream({
                model: "google/flan-t5-xxl", //Need to replace this with the model the user chooses
                inputs: 'repeat "one two three four"',
                parameters: { max_new_tokens: 250 }
              })) {
                answer += output.generated_text;
            }
        }
        document.getElementById('response').innerText = answer;

    } catch(e){
        console.log("Error loading documents:", e);
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('submitButton');
    const chosenService = document.getElementById('aiModel');
    const otherApiKeyField = document.getElementById('otherApiKeyContainer'); // Div or input container

    // Function to check if another API key is needed
    function checkOtherAPIKeyRequirement() {
        const service = chosenService.value;
        const needsOtherAPIKey = ["Anthropic", "Google", "FireworksAI", "Groq", "MistralAI", "TogetherAI"].includes(service);

        // Show or hide the other API key field accordingly
        if (needsOtherAPIKey) {
            otherApiKeyField.style.display = "block";
        } else {
            otherApiKeyField.style.display = "none";
        }
    }

    // Listen for model selection change
    chosenService.addEventListener('change', checkOtherAPIKeyRequirement);

    // Execute function on page load in case the dropdown is preselected
    checkOtherAPIKeyRequirement();

    // Add event listener for the button
    button.addEventListener('click', () => {
        pullFromRepo();
    });
});

