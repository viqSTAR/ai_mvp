import OpenAI from "openai";

let openai;

export const parseReminder = async (text) => {
    if (!openai) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    try {
        const today = new Date().toLocaleDateString('en-CA');
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const dayAfter = new Date(Date.now() + 172800000).toISOString().split('T')[0];

        const res = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: `Extract reminder details from user input.
Today: ${today}

REMINDER vs ROUTINE:
- REMINDER = ONE-TIME event (tomorrow, next week, January 30th)
- ROUTINE = RECURRING habit (daily, weekly, every Monday)

Return isReminder: false if:
- User mentions "daily", "everyday", "every day", "weekly", "every Monday"
- User mentions "routine" or "habit"

Return isReminder: true if:
- User says "remind me", "reminder", "don't forget"
- Uses specific dates: "tomorrow", "next week", "January 30"
- One-time tasks

DATE PARSING:
- "tomorrow" = ${tomorrow}
- "day after tomorrow" = ${dayAfter}
- "next Monday" = calculate actual date
- "January 30th" or "30 jan" = 2026-01-30
- "5 feb" = 2026-02-05
- No date mentioned = ${today}

Return JSON:
{
  "isReminder": boolean,
  "title": string | null,
  "time": "h:mm AM/PM" | null (default "9:00 AM" if not specified),
  "date": "YYYY-MM-DD" | null (default "${today}" if not specified)
}`
                },
                { role: "user", content: text },
            ],
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(res.choices[0].message.content);
        console.log("📅 Parsed Reminder:", result);
        return result;
    } catch (error) {
        console.error("Parse Reminder Error:", error.message);
        return null;
    }
};
