/**
 * Intent Detection Service
 * 
 * Classifies user messages into intents using a cheap AI call.
 * Intents: "chat" | "create_reminder" | "create_routine" | "set_timer" | "start_stopwatch" | "add_stage"
 */

import OpenAI from "openai";

let openai;

const INTENT_SYSTEM_PROMPT = `You are an intent classifier. Analyze the user message and return ONLY one of these intents:

- "create_reminder" - User wants to set a reminder (e.g., "remind me to...", "yaad dila dena...", "kal subah uthna hai")
- "create_routine" - User wants to create a recurring routine (e.g., "daily 7 am walk", "har din yoga karna hai", "every morning...")
- "set_timer" - User wants to set a countdown timer (e.g., "set a 5 minute timer", "10 minute timer lagao")
- "start_stopwatch" - User wants to start a stopwatch (e.g., "start stopwatch", "stopwatch chalu karo")
- "add_stage" - User wants to add a stage/step to an existing reminder (e.g., "add stage buy milk to shopping", "shopping mein eggs add karo")
- "chat" - User wants to have a conversation, ask questions, or anything else

Rules:
1. Return ONLY the intent string, nothing else (no quotes, no explanation)
2. If unclear, default to "chat"
3. "create_reminder" = one-time or specific date/time tasks
4. "create_routine" = repeated/daily/weekly activities
5. "set_timer" = any countdown in seconds, minutes, or hours
6. "start_stopwatch" = stopwatch/lap timer request
7. "add_stage" = explicitly adding an item/step to an existing task

Examples:
- "remind me to call mom tomorrow" → create_reminder
- "mujhe kal 5 baje meeting yaad dilana" → create_reminder
- "remind me to go shopping: buy milk, eggs, paneer" → create_reminder
- "I want to wake up at 7am every day" → create_routine
- "har din exercise karna hai" → create_routine
- "set a 10 minute timer" → set_timer
- "5 minute timer" → set_timer
- "start stopwatch" → start_stopwatch
- "stopwatch shuru karo" → start_stopwatch
- "add buy bread to my shopping reminder" → add_stage
- "what's the weather?" → chat
- "tell me a joke" → chat
- "kaise ho?" → chat`;

/**
 * Detects intent from user message
 * @param {string} userMessage - The user's message text
 * @returns {Promise<"chat" | "create_reminder" | "create_routine" | "set_timer" | "start_stopwatch" | "add_stage">}
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
        const validIntents = ["chat", "create_reminder", "create_routine", "set_timer", "start_stopwatch", "add_stage"];
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

    // Timer
    if (intent === "set_timer") {
        const timerPrompt = `Extract timer details. Return JSON:
{
  "hours": 0,
  "minutes": 5,
  "seconds": 0
}
Only return valid JSON, nothing else.`;
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: timerPrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 0, max_tokens: 80,
            });
            return JSON.parse(response.choices[0].message.content?.trim());
        } catch { return { hours: 0, minutes: 5, seconds: 0 }; }
    }

    // Stopwatch — no details needed
    if (intent === "start_stopwatch") return {};

    // Add Stage
    if (intent === "add_stage") {
        const stagePrompt = `Extract the stage/item to add and which reminder it belongs to. Return JSON:
{
  "reminderTitle": "Shopping" or null,
  "stageTitle": "buy milk"
}
Only return valid JSON, nothing else.`;
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: stagePrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 0, max_tokens: 100,
            });
            return JSON.parse(response.choices[0].message.content?.trim());
        } catch { return null; }
    }

    // Reminder / Routine extraction
    const extractionPrompt = intent === "create_reminder"
        ? `Extract reminder details. Return JSON:
{
  "title": "short task description",
  "time": "HH:MM AM/PM or null",
  "date": "today/tomorrow/YYYY-MM-DD or null",
  "stages": ["stage 1 title", "stage 2 title"] or [],
  "aiNotificationBody": "a unique, friendly, motivating notification text for this specific task (max 80 chars), e.g. 'Have you finished your leg day? 💪 Let's crush it!'"
}
Rules: If the user mentions items like "buy milk, eggs, paneer" or steps like "lunges, squats", put them in 'stages'.
Only return valid JSON, nothing else.`
        : `Extract routine details. Return JSON:
{
  "title": "short activity description",
  "time": "HH:MM (24h format) or null",
  "repeat": "daily/weekly/weekdays/weekends",
  "selectedDays": ["Mon", "Tue"] or null for daily
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
            max_tokens: 250,
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
