/**
 * Intent Detection Service
 * 
 * Classifies user messages into intents using a cheap AI call.
 * Intents: "chat" | "create_reminder" | "create_routine" | "unknown"
 */

import OpenAI from "openai";

let openai;

const INTENT_SYSTEM_PROMPT = `You are an intent classifier. Analyze the user message and return ONLY one of these intents:

- "create_reminder" - User wants to set a reminder (e.g., "remind me to...", "yaad dila dena...", "kal subah uthna hai")
- "create_routine" - User wants to create a recurring routine (e.g., "daily 7 am walk", "har din yoga karna hai", "every morning...")
- "chat" - User wants to have a conversation, ask questions, or anything else

Rules:
1. Return ONLY the intent string, nothing else (no quotes, no explanation)
2. If unclear, default to "chat"
3. "create_reminder" = one-time or specific date/time tasks
4. "create_routine" = repeated/daily/weekly activities

Examples:
- "remind me to call mom tomorrow" → create_reminder
- "mujhe kal 5 baje meeting yaad dilana" → create_reminder
- "I want to wake up at 7am every day" → create_routine
- "har din exercise karna hai" → create_routine
- "what's the weather?" → chat
- "tell me a joke" → chat
- "kaise ho?" → chat`;

/**
 * Detects intent from user message
 * @param {string} userMessage - The user's message text
 * @returns {Promise<"chat" | "create_reminder" | "create_routine" | "unknown">}
 */
export const detectIntent = async (userMessage) => {
    if (!openai) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Cheapest model for classification
            messages: [
                { role: "system", content: INTENT_SYSTEM_PROMPT },
                { role: "user", content: userMessage }
            ],
            temperature: 0, // Deterministic output
            max_tokens: 20, // Intent is just one word
        });

        const intent = response.choices[0].message.content?.trim().toLowerCase();

        // Validate intent
        const validIntents = ["chat", "create_reminder", "create_routine"];
        if (validIntents.includes(intent)) {
            return intent;
        }

        return "unknown";
    } catch (error) {
        console.error("Intent Detection Error:", error);
        return "unknown";
    }
};

/**
 * Extracts reminder/routine details from user message
 * @param {string} userMessage - The user's message
 * @param {"create_reminder" | "create_routine"} intent - The detected intent
 * @returns {Promise<object>} - Structured data for reminder/routine
 */
export const extractDetails = async (userMessage, intent) => {
    if (!openai) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    const extractionPrompt = intent === "create_reminder"
        ? `Extract reminder details from the message. Return JSON:
{
  "title": "short task description",
  "time": "HH:MM AM/PM or null if not specified",
  "date": "today/tomorrow/YYYY-MM-DD or null"
}
Only return valid JSON, nothing else.`
        : `Extract routine details from the message. Return JSON:
{
  "title": "short activity description",
  "time": "HH:MM (24h format) or null",
  "repeat": "daily/weekly/weekdays/weekends",
  "selectedDays": ["Mon", "Tue", ...] or null for daily
}
Only return valid JSON, nothing else.`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: extractionPrompt },
                { role: "user", content: userMessage }
            ],
            temperature: 0,
            max_tokens: 150,
        });

        const jsonStr = response.choices[0].message.content?.trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Detail Extraction Error:", error);
        return null;
    }
};

// ============ TEST FUNCTION ============
// Run this file directly to test: node src/services/intent.service.js
if (process.argv[1].includes("intent.service.js")) {
    const testMessages = [
        "remind me to call doctor tomorrow at 3pm",
        "mujhe kal subah 7 baje uthna hai yaad dilana",
        "I want to go for a walk every morning at 6",
        "har din meditation karna hai",
        "what's 2 + 2?",
        "tell me about javascript",
        "kaise ho bhai?",
    ];

    (async () => {
        console.log("\\n🧪 Testing Intent Detection:\\n");
        for (const msg of testMessages) {
            const intent = await detectIntent(msg);
            console.log(`"${msg}"`);
            console.log(`  → Intent: ${intent}`);

            if (intent === "create_reminder" || intent === "create_routine") {
                const details = await extractDetails(msg, intent);
                console.log(`  → Details:`, details);
            }
            console.log();
        }
    })();
}
