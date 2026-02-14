import OpenAI from "openai";
import Conversation from "../models/Conversation.js";
import Schedule from "../models/Schedule.js";

let openai;

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
                    icon: { type: "string", description: "Icon name (e.g., 'fitness-outline', 'book-outline')." }
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
                    alarmEnabled: { type: "boolean", description: "Enable/disable alarm (true/false)." },
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
];

export const chatWithAI = async (req, res) => {
    const client = getOpenAIClient();

    try {
        const { messages, currentPendingAction } = req.body;
        const userId = req.clerkId;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ success: false, error: "Messages array is required" });
        }

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

        // 2. Prepare System Message
        const today = new Date().toLocaleDateString('en-CA');
        const systemMessage = {
            role: "system",
            content: `You are a helpful AI assistant managing a user's schedule.
Today is ${today}.

${scheduleContext}

INSTRUCTIONS:
- Use the provided tools to create, update, or delete notifications.
- If the user asks to "change" or "reschedule" something, look at the CURRENT SCHEDULE to find the ID and use 'update_...' tools.
- If the user confirms a pending action ("yes", "do it"), just acknowledge it nicely in text (the frontend handles the confirmation flow usually, but staying consistent is good).
- **CRITICAL:** If the user says they "completed" or "did" a reminder/routine, DO NOT immediate calling a tool. Instead, ask them: "Well done! Now shall I mark it as complete or delete it?". Wait for their response to either call 'update_reminder(completed: true)' or 'delete_item'.
- If the user asks if they have a specific reminder/routine (e.g., "Do I have a workout routine?"), use 'get_item' to show them the card if you find a match.
- Be concise.
- If creating a routine without specified days, ask for them OR default to "daily" if implied.
- LANGUAGE: Reply in the same language as the user (Hindi/English).`,
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
                pendingAction = { type: "create_reminder", data: args };
            } else if (functionName === "create_routine") {
                // Default defaults if missing
                if (!args.repeat) args.repeat = "daily";
                if (!args.selectedDays) args.selectedDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                if (!args.icon) args.icon = "time-outline";
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

            // Generate a natural confirmation message based on the action
            let confirmMessage = "";
            if (functionName.includes("create")) {
                confirmMessage = `Done! I've added "${args.title}" to your schedule.`;
            } else if (functionName.includes("update")) {
                confirmMessage = `Updated! "${args.title || 'It'}" has been modified.`;
            } else if (functionName.includes("delete")) {
                confirmMessage = `Deleted. That's gone from your schedule.`;
            } else if (functionName === "get_item") {
                const title = pendingAction?.data?.title || "that";
                confirmMessage = `Oh, I got it! You are asking about "${title}".`;
            }

            return res.json({
                success: true,
                message: confirmMessage, // AI generic confirmation
                pendingAction,
            });
        }

        // 5. No Tool Call - Normal Response
        return res.json({
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
