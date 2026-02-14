import OpenAI from "openai";

let openai;

export const editReminder = async (text, current) => {
    if (!openai) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    const today = new Date().toLocaleDateString('en-CA');
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const dayAfter = new Date(Date.now() + 172800000).toISOString().split('T')[0];

    const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
            {
                role: "system",
                content: `Edit an existing reminder based on user request.
Today: ${today}

Current reminder:
${JSON.stringify(current, null, 2)}

User wants to modify it. Only change what they explicitly ask for.

DATE PARSING:
- "tomorrow" = ${tomorrow}
- "day after tomorrow" = ${dayAfter}
- "next Monday" = calculate actual date
- "5 feb" = 2026-02-05
- "10 feb" = 2026-02-10

Return JSON with ALL fields (keep unchanged values from current):
{
  "title": string,
  "time": "h:mm AM/PM" | null,
  "date": "YYYY-MM-DD" | null
}

Rules:
- Only change fields user explicitly mentions
- Keep others EXACTLY as they are in current reminder
- "change title to X" or "rename to X" → update title
- "change time to X" or "at X" → update time
- "change date to X" or "on X" or "tomorrow" → update date`
            },
            { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
    });

    return JSON.parse(res.choices[0].message.content);
};
