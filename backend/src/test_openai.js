import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function run() {
    try {
        console.log("Starting chat completion...");

        const tools = [{
            type: "function",
            function: {
                name: "search_web",
                description: "Search Wikipedia.",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string" },
                    },
                    required: ["query"],
                },
            },
        }];

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: "But someone in Iran had died recently, like a president maybe." }],
            tools: tools
        });

        const aiMessage = response.choices[0].message;
        console.log("AI Message:", JSON.stringify(aiMessage, null, 2));

        if (aiMessage.tool_calls) {
            const toolCall = aiMessage.tool_calls[0];

            const toolMessage = {
                role: "tool",
                tool_call_id: toolCall.id,
                content: "Web Search Results: [Result 1] Title: Ebrahim Raisi\nExtract: President of Iran died in a helicopter crash."
            };

            const cleanAiMessage = {
                role: "assistant",
                content: aiMessage.content || null,
                tool_calls: aiMessage.tool_calls
            };

            console.log("Sending followup...");

            const followup = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "user", content: "But someone in Iran had died recently, like a president maybe." },
                    cleanAiMessage,
                    toolMessage
                ]
            });

            console.log("Followup response:", followup.choices[0].message.content);
        }
    } catch (e) {
        console.error("CRASH ERROR:", e);
    }
}

run();
