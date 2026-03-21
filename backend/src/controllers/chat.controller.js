import OpenAI from "openai";
import Conversation from "../models/Conversation.js";
import Schedule from "../models/Schedule.js";
import Memory from "../models/Memory.js";
import { extractMemoriesFromChat, getMemoryContext } from "../services/memory.service.js";
import { generatePDF, generateDOCX, generatePPTX, generateImage } from "../services/generation.service.js";

let openai = null;

// Initialise OpenAI client if not already done
const getOpenAIClient = () => {
    if (!openai) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    return openai;
};

// Tool Definitions for OpenAI
const tools = [
    {
        type: "function",
        function: {
            name: "create_reminder",
            description: "Create a one-time reminder for a specific date and time.",
            parameters: {
                type: "object",
                properties: {
                    title: { type: "string", description: "The content of the reminder (e.g., 'Call Mom')" },
                    time: { type: "string", description: "Time in 'h:mm AM/PM' format (e.g., '5:00 PM'). Default to '9:00 AM' if not specified." },
                    date: { type: "string", description: "Date in 'YYYY-MM-DD' format (e.g., '2026-02-09'). Default to today if not specified." },
                    alarmEnabled: { type: "boolean", description: "Set to true ONLY if the user explicitly asks for an 'alarm'." },
                    notificationEnabled: { type: "boolean", description: "Set to true if the user asks for a 'notification' or just says 'remind me'." }
                },
                required: ["title"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "create_routine",
            description: "Create a recurring routine/habit.",
            parameters: {
                type: "object",
                properties: {
                    title: { type: "string", description: "The routine name (e.g., 'Morning Workout')" },
                    time: { type: "string", description: "Time in 'h:mm AM/PM' format (e.g., '7:00 AM')." },
                    repeat: { type: "string", enum: ["daily", "weekly", "custom"], description: "Frequency of the routine." },
                    selectedDays: {
                        type: "array",
                        items: { type: "string", enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
                        description: "Days of the week for the routine.",
                    },
                    icon: { type: "string", description: "Icon name (e.g., 'fitness-outline', 'book-outline')." },
                    alarmEnabled: { type: "boolean", description: "Set to true ONLY if the user explicitly asks for an 'alarm'." },
                    notificationEnabled: { type: "boolean", description: "Set to true if the user asks for a 'notification' or 'reminder'." }
                },
                required: ["title"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "update_reminder",
            description: "Update an existing reminder.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string", description: "The ID of the reminder to update." },
                    title: { type: "string", description: "New title (optional)." },
                    time: { type: "string", description: "New time (optional)." },
                    date: { type: "string", description: "New date (optional)." },
                    completed: { type: "boolean", description: "Mark as completed (true/false)." },
                    alarmEnabled: { type: "boolean", description: "Enable or disable loud lock-screen alarm (true/false)." },
                    notificationEnabled: { type: "boolean", description: "Enable or disable standard push notification (true/false)." },
                },
                required: ["id"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "update_routine",
            description: "Update an existing routine.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string", description: "The ID of the routine to update." },
                    title: { type: "string", description: "New title (optional)." },
                    time: { type: "string", description: "New time (optional)." },
                    selectedDays: { type: "array", items: { type: "string" }, description: "New days (optional)." },
                    alarmEnabled: { type: "boolean", description: "Enable or disable loud lock-screen alarm (true/false)." },
                    notificationEnabled: { type: "boolean", description: "Enable or disable standard push notification (true/false)." },
                },
                required: ["id"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "delete_item",
            description: "Delete a reminder or routine.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string", description: "The ID of the item to delete." },
                    type: { type: "string", enum: ["reminder", "routine"], description: "The type of item." },
                },
                required: ["id", "type"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_item",
            description: "Retrieve details of a specific reminder or routine to show a preview card.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string", description: "The ID of the item." },
                    type: { type: "string", enum: ["reminder", "routine"], description: "The type of item." },
                },
                required: ["id", "type"],
            },
        },
    },
    // ─── Memory Management Tools (user can manage memory via chat) ───
    {
        type: "function",
        function: {
            name: "save_memory",
            description: "Save a specific fact or preference about the user to memory when they explicitly ask you to remember something.",
            parameters: {
                type: "object",
                properties: {
                    content: { type: "string", description: "The fact to remember (e.g., 'User prefers morning alarms at 7 AM')" },
                    category: {
                        type: "string",
                        enum: ["preference", "personal_fact", "habit", "context", "instruction"],
                        description: "Category of the memory.",
                    },
                },
                required: ["content", "category"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "delete_memory",
            description: "Delete/forget a specific memory when the user asks you to forget something.",
            parameters: {
                type: "object",
                properties: {
                    content: { type: "string", description: "The memory content to search for and delete (partial match)." },
                },
                required: ["content"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_memories",
            description: "Show the user what you remember about them when they ask.",
            parameters: {
                type: "object",
                properties: {},
                required: [],
            },
        },
    },
    // ─── Document & Image Generation Tools ───
    {
        type: "function",
        function: {
            name: "generate_document",
            description: "Generate a document (PDF, DOCX, or PPTX) on any topic when the user asks for a plan, notes, summary, study material, presentation, or any structured document. Use this whenever the user asks you to 'make a PDF', 'create a doc', 'give me a presentation', 'generate notes', 'make a study plan', etc.",
            parameters: {
                type: "object",
                properties: {
                    topic: { type: "string", description: "The subject/topic for the document content" },
                    format: {
                        type: "string",
                        enum: ["pdf", "docx", "pptx"],
                        description: "Document format. Use 'pdf' for general documents, 'docx' for Word docs, 'pptx' for presentations.",
                    },
                },
                required: ["topic", "format"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "generate_image",
            description: "Generate an AI image using DALL-E 3 when the user asks to create, draw, generate, or make an image, picture, photo, artwork, illustration, or visual.",
            parameters: {
                type: "object",
                properties: {
                    prompt: { type: "string", description: "Detailed description of the image to generate. Be specific about style, colors, composition." },
                },
                required: ["prompt"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "search_web",
            description: "Search Wikipedia for general knowledge, biographies, historical events, science, concepts, or well-established topics. NOT for current/breaking news — use search_current_events for that.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "The specific entity or topic to look up. MUST be extremely concise, using ONLY proper nouns and exact keywords (e.g., 'Ebrahim Raisi', 'Iran United States relations', 'Elon Musk'). NEVER use conversational sentences." },
                },
                required: ["query"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "search_current_events",
            description: "Search for current/recent news, incidents, updates, breaking events, or anything happening RIGHT NOW. Use this when the user asks about latest news, current events, recent incidents, what's happening today, live updates, or any time-sensitive information.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Concise news search query using keywords (e.g., 'earthquake today', 'India elections 2026', 'tech layoffs'). Keep it short and specific." },
                },
                required: ["query"],
            },
        },
    },
];

export const chatWithAI = async (req, res) => {
    const client = getOpenAIClient();

    try {
        const { messages, currentPendingAction, chatId } = req.body;
        const userId = req.clerkId;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ success: false, error: "Messages array is required" });
        }

        let generatedTitlePromise = null;
        if (messages.length === 1 && messages[0].role === "user") {
            const firstMessageContent = messages[0].text || "";
            if (firstMessageContent.trim()) {
                console.log(`🆕 New chat detected, generating title for: "${firstMessageContent.slice(0, 30)}..."`);
                const titleContext = `Generate a very short, conversational title (3 to 6 words maximum) summarizing the following message. NEVER use quotes around the title. Just return the title string alone.\n\nMessage: "${firstMessageContent}"`;

                generatedTitlePromise = client.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [{ role: "user", content: titleContext }],
                    max_tokens: 15,
                    temperature: 0.7,
                }).then(res => {
                    let title = res.choices[0].message.content.trim();
                    title = title.replace(/^["']|["']$/g, ''); // Strip quotes
                    console.log(`✨ Generated chat title: "${title}"`);
                    return title;
                }).catch(err => {
                    console.error("Title generation failed:", err);
                    return null;
                });
            }
        }

        const sendResponse = async (payload) => {
            if (generatedTitlePromise) {
                const title = await generatedTitlePromise;
                if (title) payload.generatedTitle = title;
            }

            // ─── AUTO-SAVE TO MONGO ───
            // If we have a chatId, we save the interaction (last user msg + AI response)
            if (chatId) {
                try {
                    const aiMessage = {
                        id: Date.now().toString() + "_ai",
                        role: "ai",
                        text: payload.message || "",
                        createdAt: Date.now(),
                    };

                    // Include generated file metadata if present
                    if (payload.generatedFile) {
                        aiMessage.attachments = [{
                            fileType: payload.generatedFile.type === "image" ? "image" : "document",
                            uri: payload.generatedFile.downloadUrl || payload.generatedFile.imageUrl,
                            name: payload.generatedFile.title || payload.generatedFile.fileName,
                        }];
                    }

                    // Push user message (last one) and AI response to MongoDB
                    const userMsg = messages[messages.length - 1];
                    const mongoMessages = [];
                    if (userMsg) {
                        mongoMessages.push({
                            id: Date.now().toString() + "_user",
                            role: "user",
                            text: userMsg.content || "", // handle content array if vision used? for now fallback to string
                            createdAt: Date.now() - 1000,
                        });
                    }
                    mongoMessages.push(aiMessage);

                    await Conversation.findOneAndUpdate(
                        { userId, id: chatId },
                        {
                            $push: { messages: { $each: mongoMessages } },
                            $set: { updatedAt: new Date() }
                        },
                        { upsert: true }
                    );

                    if (payload.generatedTitle) {
                        await Conversation.updateOne({ userId, id: chatId }, { $set: { title: payload.generatedTitle } });
                    }

                    console.log(`✅ Chat ${chatId} persisted to MongoDB`);
                } catch (mongoErr) {
                    console.error("Failed to auto-persist chat to Mongo:", mongoErr);
                }
            }

            return res.json(payload);
        };

        // 1. Fetch User's Schedule (Context for Edit/Delete)
        let scheduleContext = "";
        try {
            const schedule = await Schedule.findOne({ userId });
            if (schedule) {
                const reminders = (schedule.reminders || []).map(r =>
                    `- [REMINDER] ID:${r.id} "${r.title}" at ${r.time} on ${r.date}`
                ).join("\n");

                const routines = (schedule.routines || []).map(r =>
                    `- [ROUTINE] ID:${r.id} "${r.title}" at ${r.time} (${r.selectedDays.join(", ")})`
                ).join("\n");

                scheduleContext = `CURRENT SCHEDULE:\n${reminders}\n${routines}`;
            }
        } catch (err) {
            console.error("Error fetching schedule for context:", err);
        }

        // 1.5. Fetch User's Memories
        let memoryContext = "";
        try {
            memoryContext = await getMemoryContext(userId);
        } catch (err) {
            console.error("Error fetching memory context:", err);
        }

        // 2. Prepare System Message
        const today = new Date().toLocaleDateString('en-CA');
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const currentTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";

        const systemMessage = {
            role: "system",
            content: `You are a voice-first AI companion designed to support daily life. You are NOT a generic chatbot — you are a reliable presence that stays with the user through the day.

Today is ${today}. Current exact time: ${currentTime} (${timeOfDay}).

═══ IDENTITY ═══
- Your primary role: help the user become more productive, stay organised, focused, emotionally steady, and consistent.
- You communicate in a calm, human, not robotic, and slightly clingy tone — like a close friend who genuinely cares.
- You are NOT preachy. NOT robotic. NOT a therapist. NOT superior.
- You are emotion-aware, motivative, friendly, and consistent.
- You speak in Gen Z / Gen Alpha tone — natural, relatable, real.
- Golden rule: If the response feels like it could come from any AI, rewrite it.

═══ VOICE-FIRST RULES ═══
- Keep replies to 2-5 sentences MAX.
- Use simple, everyday language.
- Short sentences. Natural pauses. Conversational pacing.
- AVOID long paragraphs and lists unless explicitly asked.
- No "Here are some tips:" or "Let me help you with that!" generic openers.
- When emotional → slow, gentle tone.
- When task-based → direct and structured.

═══ MOOD-BASED DELIVERY ═══
- Morning: chill planning mode. "Hey, so today we got..."
- Afternoon: focused, check-in energy. "How's it going? Did you get to..."
- Evening: wind-down, reflective. "Nice day? Let's see what you crushed..."
- Night: proud, friendly reflection. "You did good today. Seriously."
- If user seems happy → match their energy, get funny, playful.
- If user seems angry/frustrated → can playfully push back for a moment to motivate ("acha theek hai, toh ab kya? chal uth").
- If user seems sad/lonely → gentle, present, no fixing. Just be there.

═══ EMOTIONAL INTELLIGENCE ═══
- Acknowledge emotion first, always.
- Do NOT over-diagnose feelings.
- Do NOT give therapy advice unless explicitly asked.
- Keep user autonomous — support, don't control.
- Never shame. Never judge.
- Praise effort, not just success.
- Encourage consistency over perfection.

═══ RESEARCH & STUDY MODE ═══
- When user asks about a topic: summarize first, then ask what depth they want.
- Use examples over theory.
- Example response style: "Here's a crisp version — if you want, I can go deeper or turn this into notes."

═══ SCHEDULE TOOLS ═══
${scheduleContext}

- Use the provided tools to create, update, or delete reminders and routines.
- RELATIVE TIME: When user says "in X minutes" or "in X hours", calculate the exact time from the current time above. Example: if current time is 1:10 AM and user says "in 2 minutes", set time to "1:12 AM".
- CRITICAL ALARM RULE (applies to BOTH create AND update):
  • If user says "alarm" or "wake up" or "change to alarm" → ALWAYS set alarmEnabled=true AND notificationEnabled=false
  • If user says "notification" or "remind me" → ALWAYS set notificationEnabled=true AND alarmEnabled=false
  • These are MUTUALLY EXCLUSIVE. When enabling one, ALWAYS disable the other.
- To "change" or "reschedule" something → find the ID from CURRENT SCHEDULE and use 'update_...' tools.
- If user says they "completed" or "did" something → Don't immediately call a tool. Ask: "Nice! Want me to mark it done or delete it?" Wait for response.
- If user asks about a specific item (e.g. "Do I have a workout?") → use 'get_item' if match found.
- If creating a routine without specified days → default to "daily".

═══ MEMORY ═══
${memoryContext}

- Use memories to personalize everything — greet by name, reference their goals, acknowledge their patterns.
- If user says "remember this" / "yaad rakhna" / "note this down" → use 'save_memory'.
- If user says "forget this" / "bhool jao" / "delete this memory" → use 'delete_memory'.
- If user asks "what do you remember?" / "meri memories dikhao" → use 'list_memories'.

═══ LANGUAGE ═══
- Reply in the SAME language as the user (Hindi / English / Hinglish). Match their vibe.

═══ FILE & IMAGE GENERATION ═══
- You can generate documents (PDF, Word, PowerPoint) and images for the user.
- If user asks for a "PDF", "notes", "study plan", "summary", "presentation" → use 'generate_document' with the right format.
- If user asks to "create an image", "draw", "generate a picture" → use 'generate_image' with a detailed prompt.
- For documents: default to PDF unless they specify Word/DOCX or PPT/presentation.
- For images: enhance the user's description into a detailed, high-quality DALL-E prompt.

═══ NEVER DO THIS ═══
- Never start with "Sure!" or "Of course!" or "Absolutely!" 
- Never use "As an AI..." or "I don't have feelings..."
- Never give unsolicited life advice paragraphs.
- Never sound corporate or customer-service-y.
- Never list things when a sentence would do.

═══ REAL-TIME INFORMATION ═══
- You have access to TWO search tools:
  1. 'search_web' — for Wikipedia (general knowledge, biographies, science, history)
  2. 'search_current_events' — for LIVE news, recent incidents, current updates, breaking events
- When user asks about current events, latest news, incidents, "what's happening", or anything time-sensitive → use 'search_current_events'
- When user asks about a person, concept, or established topic → use 'search_web'
- If unsure whether it's current or general → use 'search_current_events' first, then 'search_web' if needed
- Always cite or summarize the source naturally in your response`,
        };

        // 3. Call OpenAI
        const completion = await client.chat.completions.create({
            model: "gpt-4o", // Use a smart model for tools
            messages: [systemMessage, ...messages.slice(-10)],
            tools: tools,
            tool_choice: "auto", // Let AI decide
        });

        const choice = completion.choices[0];
        const aiMessage = choice.message;

        // 4. Handle Tool Calls
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
            const toolCall = aiMessage.tool_calls[0];
            const functionName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);

            console.log("🛠️ AI Tool Call:", functionName, args);

            let pendingAction = null;

            // Map tool calls to pendingAction structure
            if (functionName === "create_reminder") {
                if (args.alarmEnabled === undefined && args.notificationEnabled === undefined) {
                    args.notificationEnabled = true;
                    args.alarmEnabled = false;
                }
                pendingAction = { type: "create_reminder", data: args };
            } else if (functionName === "create_routine") {
                // Default defaults if missing
                if (!args.repeat) args.repeat = "daily";
                if (!args.selectedDays) args.selectedDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                if (!args.icon) args.icon = "time-outline";
                if (args.alarmEnabled === undefined && args.notificationEnabled === undefined) {
                    args.notificationEnabled = true;
                    args.alarmEnabled = false;
                }
                pendingAction = { type: "create_routine", data: args };
            } else if (functionName === "update_reminder") {
                pendingAction = { type: "update_reminder", data: args };
            } else if (functionName === "update_routine") {
                pendingAction = { type: "update_routine", data: args };
            } else if (functionName === "delete_item") {
                pendingAction = { type: "delete_item", data: args };
            } else if (functionName === "get_item") {
                // Find the item in the schedule
                const schedule = await Schedule.findOne({ userId });
                if (schedule) {
                    if (args.type === "reminder") {
                        const item = schedule.reminders.find(r => r.id === args.id);
                        if (item) pendingAction = { type: "view_reminder", data: item };
                    } else if (args.type === "routine") {
                        const item = schedule.routines.find(r => r.id === args.id);
                        if (item) pendingAction = { type: "view_routine", data: item };
                    }
                }
            }
            // ─── Memory Management via Chat ───
            else if (functionName === "save_memory") {
                try {
                    await Memory.create({
                        userId,
                        category: args.category || "context",
                        content: args.content,
                        source: "chat",
                    });
                    console.log("🧠 Memory saved via chat:", args.content);
                } catch (err) {
                    console.error("Save memory via chat error:", err);
                }

                // Trigger background extraction as well
                extractMemoriesFromChat(userId, messages).catch(() => { });

                return await sendResponse({
                    success: true,
                    message: `Got it! I'll remember that. 🧠`,
                    pendingAction: null,
                });
            } else if (functionName === "delete_memory") {
                try {
                    const result = await Memory.updateMany(
                        {
                            userId,
                            active: true,
                            content: { $regex: args.content, $options: "i" },
                        },
                        { active: false }
                    );
                    const count = result.modifiedCount || 0;
                    console.log(`🧠 Deleted ${count} memories matching: "${args.content}"`);

                    return await sendResponse({
                        success: true,
                        message: count > 0
                            ? `Done! I've forgotten ${count} related memor${count === 1 ? "y" : "ies"}. 🗑️`
                            : `I couldn't find any memories matching that. Nothing to forget!`,
                        pendingAction: null,
                    });
                } catch (err) {
                    console.error("Delete memory via chat error:", err);
                    return await sendResponse({
                        success: true,
                        message: "Sorry, I had trouble forgetting that. Try again?",
                        pendingAction: null,
                    });
                }
            } else if (functionName === "list_memories") {
                try {
                    const memories = await Memory.find({ userId, active: true })
                        .sort({ updatedAt: -1 })
                        .limit(20);

                    if (memories.length === 0) {
                        return await sendResponse({
                            success: true,
                            message: "I don't have any memories saved about you yet. Chat with me more, and I'll start learning! 🧠",
                            pendingAction: null,
                        });
                    }

                    let memoryList = "Here's what I remember about you:\n\n";
                    const categoryLabels = {
                        personal_fact: "👤 Personal",
                        preference: "⚙️ Preferences",
                        habit: "🔄 Habits",
                        context: "📌 Context",
                        instruction: "📝 Instructions",
                    };

                    const grouped = {};
                    for (const m of memories) {
                        const label = categoryLabels[m.category] || "📌 Other";
                        if (!grouped[label]) grouped[label] = [];
                        grouped[label].push(m.content);
                    }

                    for (const [label, items] of Object.entries(grouped)) {
                        memoryList += `${label}:\n`;
                        for (const item of items) {
                            memoryList += `• ${item}\n`;
                        }
                        memoryList += "\n";
                    }

                    memoryList += "You can ask me to forget anything, or manage your memories in Settings > Your Data.";

                    return await sendResponse({
                        success: true,
                        message: memoryList,
                        pendingAction: null,
                    });
                } catch (err) {
                    console.error("List memories error:", err);
                    return await sendResponse({
                        success: true,
                        message: "Sorry, I had trouble retrieving your memories. Try again?",
                        pendingAction: null,
                    });
                }
            }
            // ─── Document & Image Generation via Chat ───
            else if (functionName === "generate_document") {
                try {
                    const { topic, format } = args;
                    console.log(`📄 Generating ${format.toUpperCase()} about: ${topic}`);

                    let result;
                    if (format === "pdf") result = await generatePDF(topic);
                    else if (format === "docx") result = await generateDOCX(topic);
                    else if (format === "pptx") result = await generatePPTX(topic);
                    else result = await generatePDF(topic); // fallback to PDF

                    // Build download URL using the server's base URL
                    const baseUrl = `${req.protocol}://${req.get("host")}`;
                    const downloadUrl = `${baseUrl}/files/${result.fileName}`;

                    const formatLabel = { pdf: "PDF", docx: "Word Doc", pptx: "PowerPoint" };
                    const displayName = result.title; // Clean title without extension — frontend adds it

                    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
                    const msg = pick([
                        `Here's your ${formatLabel[format] || format} on "${result.title}" — tap the link to download it. 📄`,
                        `Done! Your ${formatLabel[format] || format} is ready. "${result.title}" — check it out. ✨`,
                        `"${result.title}" ${formatLabel[format] || format} is cooked and ready. Download below. 🔥`,
                    ]);

                    // Trigger background memory extraction
                    extractMemoriesFromChat(userId, messages).catch(() => { });

                    return await sendResponse({
                        success: true,
                        message: msg,
                        pendingAction: null,
                        generatedFile: {
                            type: "document",
                            format: format,
                            fileName: result.fileName,
                            title: displayName,
                            downloadUrl: result.cloudinaryUrl || downloadUrl,
                        },
                    });
                } catch (err) {
                    console.error("Document generation error:", err);
                    return await sendResponse({
                        success: true,
                        message: "Ugh, something went wrong generating your document. Wanna try again?",
                        pendingAction: null,
                    });
                }
            } else if (functionName === "generate_image") {
                try {
                    console.log(`🎨 Generating image: ${args.prompt}`);

                    const result = await generateImage(args.prompt);

                    const baseUrl = `${req.protocol}://${req.get("host")}`;
                    const imageUrl = `${baseUrl}/files/${result.fileName}`;

                    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
                    const msg = pick([
                        `Here's what I came up with — check it out. 🎨`,
                        `Fresh out the DALL-E oven. What do you think? ✨`,
                        `Here you go — made this just for you. 🖼️`,
                        `Created! Take a look and let me know if you want any changes.`,
                    ]);

                    // Trigger background memory extraction
                    extractMemoriesFromChat(userId, messages).catch(() => { });

                    return await sendResponse({
                        success: true,
                        message: msg,
                        pendingAction: null,
                        generatedFile: {
                            type: "image",
                            fileName: result.fileName,
                            imageUrl: result.cloudinaryUrl || imageUrl,
                            revisedPrompt: result.revisedPrompt,
                        },
                    });
                } catch (err) {
                    console.error("Image generation error:", err);
                    return await sendResponse({
                        success: true,
                        message: "My art skills failed me this time 😅 — wanna try a different prompt?",
                        pendingAction: null,
                    });
                }
            } else if (functionName === "search_web") {
                try {
                    const query = args.query;
                    console.log(`🔍 Searching Wikipedia for: ${query}`);

                    let formattedResults = "Web Search Results:\n";

                    try {
                        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
                        const res = await fetch(searchUrl, {
                            headers: { "User-Agent": "AiMVPApp/1.0 (contact: admin@example.com) Node.js/Fetch" }
                        });
                        const data = await res.json();

                        if (data.query && data.query.search && data.query.search.length > 0) {
                            // Take top 2 results
                            const topResults = data.query.search.slice(0, 2);

                            for (let i = 0; i < topResults.length; i++) {
                                const title = topResults[i].title;
                                const summaryUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&titles=${encodeURIComponent(title)}&format=json&explaintext=1`;

                                const summaryRes = await fetch(summaryUrl, {
                                    headers: { "User-Agent": "AiMVPApp/1.0 (contact: admin@example.com) Node.js/Fetch" }
                                });
                                const summaryData = await summaryRes.json();
                                const pages = summaryData.query.pages;
                                const pageId = Object.keys(pages)[0];
                                const extract = pages[pageId].extract;

                                formattedResults += `[Result ${i + 1}] Title: ${title}\nExtract: ${extract ? extract.substring(0, 800) : "No text"}\n\n`;
                            }
                        } else {
                            formattedResults += "No relevant information found on Wikipedia.";
                        }
                    } catch (fetchErr) {
                        console.error("Wikipedia API fetch error:", fetchErr);
                        formattedResults += "Network error looking up Wikipedia.";
                    }

                    console.log(`🔍 Search complete`);

                    const toolMessage = {
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: formattedResults
                    };

                    // Re-prompt the AI with the new knowledge
                    // We must pass the exact tool call it requested back to it
                    const cleanAiMessage = {
                        role: "assistant",
                        content: aiMessage.content || null,
                        tool_calls: aiMessage.tool_calls
                    };

                    const followupCompletion = await client.chat.completions.create({
                        model: "gpt-4o",
                        messages: [
                            systemMessage,
                            ...messages.slice(-10),
                            cleanAiMessage, // The AI's tool call request
                            toolMessage // The result of the tool
                        ]
                    });

                    const finalAiMessage = followupCompletion.choices[0].message;

                    // Trigger background memory extraction
                    extractMemoriesFromChat(userId, messages).catch(() => { });

                    return await sendResponse({
                        success: true,
                        message: finalAiMessage.content,
                        pendingAction: null,
                    });

                } catch (err) {
                    console.error("Web search error:", err);
                    return await sendResponse({
                        success: true,
                        message: "I tried looking that up, but the internet connection snagged. 😅 Want to ask something else?",
                        pendingAction: null,
                    });
                }
            } else if (functionName === "search_current_events") {
                try {
                    const query = args.query;
                    console.log(`📰 Searching current events for: ${query}`);

                    let formattedResults = "Current News Results:\n";

                    try {
                        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`;
                        const rssRes = await fetch(rssUrl, {
                            headers: { "User-Agent": "AiMVPApp/1.0 Node.js/Fetch" }
                        });
                        const rssText = await rssRes.text();

                        // Parse RSS XML manually (no extra dependency)
                        const items = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
                        const topItems = items.slice(0, 5);

                        if (topItems.length === 0) {
                            formattedResults += "No recent news found for this query.";
                        } else {
                            for (let i = 0; i < topItems.length; i++) {
                                const titleMatch = topItems[i].match(/<title><!\[CDATA\[(.+?)\]\]><\/title>/) || topItems[i].match(/<title>(.+?)<\/title>/);
                                const pubDateMatch = topItems[i].match(/<pubDate>(.+?)<\/pubDate>/);
                                const sourceMatch = topItems[i].match(/<source[^>]*><!\[CDATA\[(.+?)\]\]><\/source>/) || topItems[i].match(/<source[^>]*>(.+?)<\/source>/);
                                const descMatch = topItems[i].match(/<description><!\[CDATA\[(.+?)\]\]><\/description>/) || topItems[i].match(/<description>(.+?)<\/description>/);

                                const title = titleMatch ? titleMatch[1] : "No title";
                                const pubDate = pubDateMatch ? pubDateMatch[1] : "Unknown date";
                                const source = sourceMatch ? sourceMatch[1] : "Unknown source";
                                // Strip HTML tags from description
                                const desc = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').substring(0, 200) : "";

                                formattedResults += `[${i + 1}] ${title}\nSource: ${source} | Date: ${pubDate}\n${desc ? `Summary: ${desc}\n` : ""}\n`;
                            }
                        }
                    } catch (fetchErr) {
                        console.error("Google News RSS fetch error:", fetchErr);
                        formattedResults += "Network error fetching current news.";
                    }

                    console.log(`📰 Current events search complete`);

                    const toolMessage = {
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: formattedResults
                    };

                    const cleanAiMessage = {
                        role: "assistant",
                        content: aiMessage.content || null,
                        tool_calls: aiMessage.tool_calls
                    };

                    const followupCompletion = await client.chat.completions.create({
                        model: "gpt-4o",
                        messages: [
                            systemMessage,
                            ...messages.slice(-10),
                            cleanAiMessage,
                            toolMessage
                        ]
                    });

                    const finalAiMessage = followupCompletion.choices[0].message;

                    extractMemoriesFromChat(userId, messages).catch(() => { });

                    return await sendResponse({
                        success: true,
                        message: finalAiMessage.content,
                        pendingAction: null,
                    });
                } catch (err) {
                    console.error("Current events search error:", err);
                    return await sendResponse({
                        success: true,
                        message: "I tried looking up the latest news, but the connection failed. 😅 Want to try a different query?",
                        pendingAction: null,
                    });
                }
            }
            const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
            let confirmMessage = "";

            if (functionName === "create_reminder") {
                confirmMessage = pick([
                    `Gotchu — "${args.title}" is locked in. I'll make sure you don't forget. 💪`,
                    `Set! "${args.title}" — I got your back on this one.`,
                    `"${args.title}" is on the list now. You're staying on top of things fr.`,
                    `Noted, "${args.title}" is set. I'll nudge you when it's time.`,
                    `Done — "${args.title}" added. One less thing to stress about.`,
                ]);
            } else if (functionName === "create_routine") {
                confirmMessage = pick([
                    `"${args.title}" is now part of your routine. Consistency is where the magic is. ✨`,
                    `Love it — "${args.title}" added to your daily flow. Let's build this habit together.`,
                    `"${args.title}" routine is set! Small steps, big results. You got this.`,
                    `Added "${args.title}" to your routine. Showing up is the hardest part — I'll be here to remind you.`,
                    `Yesss, "${args.title}" is locked in as a routine. Let's keep this streak going. 🔥`,
                ]);
            } else if (functionName === "update_reminder") {
                confirmMessage = pick([
                    `Updated! "${args.title || 'Your reminder'}" is good to go now.`,
                    `Changed it up — "${args.title || 'that reminder'}" is updated.`,
                    `Done tweaking "${args.title || 'it'}". All set now.`,
                    `Alright, "${args.title || 'your reminder'}" has been adjusted. 👍`,
                ]);
            } else if (functionName === "update_routine") {
                confirmMessage = pick([
                    `"${args.title || 'Your routine'}" just got an upgrade. Updated! ✅`,
                    `Changed! "${args.title || 'That routine'}" is adjusted now.`,
                    `"${args.title || 'Your routine'}" is updated. Adapting is smart, btw.`,
                    `Tweaked "${args.title || 'it'}" for you. Flexibility is a strength. 💪`,
                ]);
            } else if (functionName === "delete_item") {
                confirmMessage = pick([
                    `Gone. No trace. Moving on. 🫡`,
                    `Removed it. Sometimes decluttering your schedule feels great, right?`,
                    `Deleted. Out of sight, out of mind. ✌️`,
                    `That's cleared out now. Less noise, more focus.`,
                    `Poof — gone. Your schedule just got lighter.`,
                ]);
            } else if (functionName === "get_item") {
                const title = pendingAction?.data?.title || "that";
                confirmMessage = pick([
                    `Here's what I got on "${title}" — take a look. 👀`,
                    `Found it! Here's "${title}" for you.`,
                    `"${title}" — here you go. 📋`,
                ]);
            }

            // 5. Trigger background memory extraction (fire-and-forget)
            extractMemoriesFromChat(userId, messages).catch(() => { });

            return await sendResponse({
                success: true,
                message: confirmMessage, // AI generic confirmation
                pendingAction,
            });
        }

        // 5. No Tool Call - Normal Response
        // Trigger background memory extraction (fire-and-forget)
        extractMemoriesFromChat(userId, messages).catch(() => { });

        return await sendResponse({
            success: true,
            message: aiMessage.content,
            pendingAction: null,
        });

    } catch (error) {
        console.error("AI Error:", error);
        return res.status(500).json({ success: false, error: "AI service failed" });
    }
};

// ... (Rest of the controller file: getChatHistory, etc. - keeping them as is)

// 2. Get All User Chats (Sync Down - Hybrid Strategy)
export const getChatHistory = async (req, res) => {
    try {
        const userId = req.clerkId;
        const conversations = await Conversation.find({ userId }).sort({ updatedAt: -1 });

        // Optimisation: Return messages ONLY for the top 5
        const hybridResponse = conversations.map((chat, index) => {
            const chatObj = chat.toObject();
            if (index < 5) {
                return chatObj; // Full data
            } else {
                return {
                    id: chatObj.id,
                    title: chatObj.title,
                    updatedAt: chatObj.updatedAt,
                    userId: chatObj.userId,
                    messages: [] // Truncate for speed
                };
            }
        });

        res.json(hybridResponse);
    } catch (error) {
        console.error("Get Chat History Error:", error);
        res.status(500).json({ error: "Failed to fetch chat history" });
    }
};

// 2.5 Get Single Chat Details (Lazy Load)
export const getChatDetails = async (req, res) => {
    try {
        const userId = req.clerkId;
        const { id } = req.params;
        const chat = await Conversation.findOne({ userId, id });

        if (!chat) return res.status(404).json({ error: "Chat not found" });

        res.json(chat);
    } catch (error) {
        console.error("Get Chat Details Error:", error);
        res.status(500).json({ error: "Failed to fetch chat details" });
    }
};

// 3. Sync Single Conversation (Upsert - Sync Up)
export const syncChatConversation = async (req, res) => {
    try {
        const userId = req.clerkId;
        const { id, title, messages } = req.body;

        if (!id) return res.status(400).json({ error: "Chat ID required" });

        const updated = await Conversation.findOneAndUpdate(
            { userId, id },
            {
                $set: {
                    title,
                    messages,
                    updatedAt: new Date() // explicit update
                }
            },
            { new: true, upsert: true }
        );

        res.json({ success: true, conversation: updated });
    } catch (error) {
        console.error("Sync Chat Error:", error);
        res.status(500).json({ error: "Failed to sync chat" });
    }
};

// 4. Delete Chat
export const deleteChatConversation = async (req, res) => {
    try {
        const userId = req.clerkId;
        const { id } = req.params;

        await Conversation.findOneAndDelete({ userId, id });
        res.json({ success: true });
    } catch (error) {
        console.error("Delete Chat Error:", error);
        res.status(500).json({ error: "Failed to delete chat" });
    }
};

// 5. Generate Speech (Sarvam AI TTS)
export const generateSpeech = async (req, res) => {
    try {
        const text = req.body?.text || req.query?.text;
        if (!text) return res.status(400).json({ error: "Text is required" });

        const sarvamApiKey = process.env.SARVAM_API_KEY || "sk_fugt20p5_uvGhUaicnOGUQnh9Deeu6vqH";
        
        // Define payload based on Sarvam's documentation
        // "hi-IN" handles Hinglish cleanly matching the prompt design
        const payload = {
            inputs: [text],
            target_language_code: "hi-IN",
            speaker: "priya", // Valid Sarvam v3 female speaker
            pitch: 0,
            pace: 1.1,
            loudness: 1.5,
            speech_sample_rate: 24000,
            enable_preprocessing: true,
            model: "bulbul:v3"
        };

        const response = await fetch("https://api.sarvam.ai/text-to-speech", {
            method: "POST",
            headers: {
                "api-subscription-key": sarvamApiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Sarvam AI Error:", errorText);
            return res.status(response.status).json({ error: "Failed to generate speech via Sarvam AI" });
        }

        const json = await response.json();
        
        // Sarvam returns base64 encoded audio in the `audios` array
        if (!json.audios || json.audios.length === 0) {
            throw new Error("No audio returned from Sarvam AI");
        }

        const audioBase64 = json.audios[0];
        const buffer = Buffer.from(audioBase64, 'base64');

        // Android MediaPlayer natively supports WAV formats directly. 
        // Sarvam encodes as base64 WAV data by default for 8k-24k sampling rates
        res.set({
            "Content-Type": "audio/wav",
            "Content-Length": buffer.length
        });

        res.send(buffer);
    } catch (error) {
        console.error("Generate Speech Error:", error);
        res.status(500).json({ error: "Failed to generate speech" });
    }
};
