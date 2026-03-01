/**
 * Memory Extraction & Management Service
 *
 * Extracts memory facts from conversations using GPT-4o-mini,
 * deduplicates against existing memories, and persists to MongoDB.
 */

import OpenAI from "openai";
import Memory from "../models/Memory.js";
import User from "../models/User.js";

let openai;

const getClient = () => {
    if (!openai) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
};

const EXTRACTION_PROMPT = `You are a memory extraction assistant. Analyze the conversation and extract important facts about the user that would be useful to remember for future conversations. Think like a close friend who naturally remembers things about people they care about.

Extract facts in these areas:
- Personal details (name, age, gender, occupation, location, family members, relationships)
- Personality & traits (introverted/extroverted, funny, serious, creative, emotional tendencies)
- Interests & hobbies (movies, music, sports, gaming, reading, cooking, art, tech interests)
- Life experiences (education, career milestones, travel stories, achievements, struggles)
- Goals & aspirations (career goals, fitness targets, learning goals, life dreams)
- Preferences (preferred times, communication style, notification style, language, food, music taste)
- Habits & routines (workout schedule, sleep pattern, study hours, daily rituals)
- Emotional context (stressed about exams, excited about a trip, going through a tough time)
- Relationships (mentions of friends, partner, family dynamics, pets)
- Lifestyle (student life, work-life balance, health conditions, dietary choices)
- Instructions (how they want to be addressed, response style preferences)
- Important upcoming events (exams, interviews, birthdays, deadlines, travel)

DO NOT extract:
- Trivial one-off small talk with no lasting value
- Things the AI said (only extract USER facts)
- Duplicates of facts already in EXISTING MEMORIES
- Vague or unclear statements

Be generous with extraction — if in doubt, extract it. It's better to remember too much than too little.

Return a JSON array of objects. If nothing worth remembering, return an empty array [].

Format:
[
  { "category": "personal_fact|preference|habit|context|instruction", "content": "concise fact about the user" }
]

ONLY return valid JSON, nothing else.`;

/**
 * Extract memories from a conversation (background, fire-and-forget)
 */
export const extractMemoriesFromChat = async (userId, messages, conversationId = null) => {
    try {
        // Check if user has memory enabled
        const user = await User.findOne({ clerkId: userId });
        if (!user || user.memoryEnabled === false) return;

        const client = getClient();

        // Fetch existing memories for deduplication context
        const existingMemories = await Memory.find({ userId, active: true })
            .sort({ updatedAt: -1 })
            .limit(50);

        const existingContext = existingMemories.length > 0
            ? "\n\nEXISTING MEMORIES (do NOT duplicate these):\n" +
            existingMemories.map(m => `- ${m.content}`).join("\n")
            : "";

        // Take only the last 6 messages for extraction (latest turn context)
        const recentMessages = messages.slice(-6).map(m => ({
            role: m.role === "ai" ? "assistant" : m.role,
            content: m.text || m.content || "",
        }));

        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: EXTRACTION_PROMPT + existingContext },
                ...recentMessages,
            ],
            temperature: 0,
            max_tokens: 500,
        });

        const raw = response.choices[0].message.content?.trim();
        if (!raw || raw === "[]") return;

        // Parse the JSON response
        let facts;
        try {
            // Strip markdown code fences if present
            const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            facts = JSON.parse(cleaned);
        } catch {
            console.error("Memory extraction JSON parse error:", raw);
            return;
        }

        if (!Array.isArray(facts) || facts.length === 0) return;

        // Save each fact
        for (const fact of facts) {
            if (!fact.content || !fact.category) continue;

            const validCategories = ["preference", "personal_fact", "habit", "context", "instruction"];
            const category = validCategories.includes(fact.category) ? fact.category : "context";

            // Check for near-duplicate (simple substring check)
            const isDuplicate = existingMemories.some(m =>
                m.content.toLowerCase().includes(fact.content.toLowerCase()) ||
                fact.content.toLowerCase().includes(m.content.toLowerCase())
            );

            if (!isDuplicate) {
                await Memory.create({
                    userId,
                    category,
                    content: fact.content,
                    source: "chat",
                    sourceId: conversationId,
                });
            }
        }

        console.log(`🧠 Extracted ${facts.length} memories for user ${userId}`);
    } catch (error) {
        // Silently fail — this is a background task
        console.error("Memory extraction error:", error.message);
    }
};

/**
 * Create a memory from habit/schedule activity
 */
export const createMemoryFromSchedule = async (userId, type, data) => {
    try {
        const user = await User.findOne({ clerkId: userId });
        if (!user || user.memoryEnabled === false) return;

        let content = "";
        let category = "habit";

        if (type === "routine_created") {
            content = `User created a ${data.repeat || "daily"} routine: "${data.title}" at ${data.time || "unspecified time"}`;
        } else if (type === "reminder_created") {
            content = `User set a reminder: "${data.title}" on ${data.date || "today"} at ${data.time || "unspecified time"}`;
            category = "context";
        } else if (type === "routine_completed") {
            content = `User completed their "${data.title}" routine`;
        } else if (type === "reminder_completed") {
            content = `User completed their "${data.title}" reminder`;
        }

        if (!content) return;

        // Check for duplicate
        const existing = await Memory.findOne({
            userId,
            content: { $regex: data.title, $options: "i" },
            active: true,
        });

        if (existing) {
            // Update the existing memory's timestamp
            existing.updatedAt = new Date();
            await existing.save();
        } else {
            await Memory.create({
                userId,
                category,
                content,
                source: type.includes("routine") ? "routine" : "reminder",
                sourceId: data.id || null,
            });
        }
    } catch (error) {
        console.error("Schedule memory error:", error.message);
    }
};

/**
 * Get formatted memory context string for system prompt injection
 */
export const getMemoryContext = async (userId) => {
    try {
        const memories = await Memory.find({ userId, active: true })
            .sort({ updatedAt: -1 })
            .limit(30);

        if (memories.length === 0) return "";

        const grouped = {};
        for (const m of memories) {
            if (!grouped[m.category]) grouped[m.category] = [];
            grouped[m.category].push(m.content);
        }

        let ctx = "USER MEMORIES (things you remember about this user):\n";
        for (const [cat, items] of Object.entries(grouped)) {
            ctx += `[${cat.toUpperCase()}]\n`;
            for (const item of items) {
                ctx += `- ${item}\n`;
            }
        }

        return ctx;
    } catch (error) {
        console.error("Memory context fetch error:", error.message);
        return "";
    }
};
