import OpenAI from "openai";

let openai;

// Keywords that MUST be present for an edit request
const EDIT_PATTERNS = [
    /\bchange\b/i,
    /\bupdate\b/i,
    /\bmodify\b/i,
    /\bedit\b/i,
    /\brename\b/i,
    /\breschedule\b/i,
    /\bmove\s+(it\s+)?to\b/i,
    /\bshift\s+(it\s+)?to\b/i,
];

// Patterns that indicate a NEW creation (not an edit)
const NEW_CREATION_PATTERNS = [
    /remind\s+me/i,
    /set\s+(a\s+)?reminder/i,
    /create\s+(a\s+)?reminder/i,
    /add\s+(\w+\s+)?reminder/i,
    /add\s+(\w+\s+)?routine/i,
    /set\s+(\w+\s+)?routine/i,
    /create\s+(\w+\s+)?routine/i,
    /new\s+reminder/i,
    /new\s+routine/i,
];

/**
 * Detects if user wants to edit an existing reminder/routine
 * Returns the identified item and what to change, or { isEditRequest: false } if not
 * 
 * CONSERVATIVE APPROACH: Only detect edits when:
 * 1. Message contains edit keywords (change, update, modify, etc.)
 * 2. Message does NOT look like a new creation request
 */
export const parseEditRequest = async (text, existingReminders = [], existingRoutines = []) => {
    if (!openai) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    // Check for edit keywords
    const hasEditKeyword = EDIT_PATTERNS.some(pattern => pattern.test(text));

    // Check if it looks like a new creation
    const looksLikeNewCreation = NEW_CREATION_PATTERNS.some(pattern => pattern.test(text));

    console.log("🔍 parseEditRequest:", {
        text: text.substring(0, 50) + "...",
        hasEditKeyword,
        looksLikeNewCreation,
        reminderCount: existingReminders.length,
        routineCount: existingRoutines.length
    });

    // If no edit keywords OR looks like new creation, skip
    if (!hasEditKeyword || looksLikeNewCreation) {
        console.log("⏭️ Skipping - not an edit request");
        return { isEditRequest: false };
    }

    // Skip if no existing items
    if (existingReminders.length === 0 && existingRoutines.length === 0) {
        console.log("⏭️ Skipping - no existing items");
        return { isEditRequest: false };
    }

    const remindersForPrompt = existingReminders.map(r => ({
        id: r.id,
        title: r.title,
        time: r.time,
        date: r.date
    }));

    const routinesForPrompt = existingRoutines.map(r => ({
        id: r.id,
        title: r.title,
        time: r.time,
        selectedDays: r.selectedDays
    }));

    try {
        const today = new Date().toLocaleDateString('en-CA');
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        const res = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: `Match the user's edit request to an existing item.
Today: ${today}

EXISTING REMINDERS:
${JSON.stringify(remindersForPrompt, null, 2)}

EXISTING ROUTINES:
${JSON.stringify(routinesForPrompt, null, 2)}

DATE EXAMPLES:
- "tomorrow" = ${tomorrow}
- "5 feb" = 2026-02-05
- "10 feb" = 2026-02-10

Return JSON:
{
  "matched": true/false,
  "itemType": "reminder" | "routine",
  "itemId": "id from list",
  "itemTitle": "title from list",
  "changes": {
    "title": "new title" (if renaming),
    "time": "h:mm AM/PM" (if changing time),
    "date": "YYYY-MM-DD" (if changing date),
    "selectedDays": ["Mon",...] (if changing days)
  }
}

Only include fields in "changes" that user wants to change.
Match by title similarity (case-insensitive, partial match OK).`
                },
                { role: "user", content: text },
            ],
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(res.choices[0].message.content);
        console.log("📝 Edit match result:", result);

        if (result.matched && result.itemId) {
            return {
                isEditRequest: true,
                itemType: result.itemType,
                itemId: result.itemId,
                itemTitle: result.itemTitle,
                changes: result.changes || {}
            };
        }

        return { isEditRequest: false };
    } catch (error) {
        console.error("❌ parseEditRequest error:", error.message);
        return { isEditRequest: false };
    }
};
