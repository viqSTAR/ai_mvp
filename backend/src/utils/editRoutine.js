import OpenAI from "openai";

let openai;

export const editRoutine = async (text, current) => {
    if (!openai) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
            {
                role: "system",
                content: `Edit an existing routine based on user request.

Current routine:
${JSON.stringify(current, null, 2)}

User wants to modify it. Only change what they explicitly ask for.

TIME PARSING:
- "7 am" = "7:00 AM"
- "morning" = "8:00 AM"
- "evening" = "6:00 PM"
- "night" = "9:00 PM"

DAY PARSING:
- "weekdays" = ["Mon", "Tue", "Wed", "Thu", "Fri"]
- "weekends" = ["Sat", "Sun"]
- "everyday" / "daily" = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
- "Monday and Wednesday" = ["Mon", "Wed"]

Return JSON with ALL fields (keep unchanged values from current):
{
  "title": string,
  "time": "h:mm AM/PM" | null,
  "repeat": "daily" | "weekly" | "custom",
  "selectedDays": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  "icon": string
}

Rules:
- Only change fields user explicitly mentions
- Keep others EXACTLY as they are in current routine
- "change title to X" or "rename to X" → update title
- "change time to X" or "at X" → update time
- "change days to X" or mentions specific days → update selectedDays
- "only weekdays" or "weekends only" → update selectedDays`
            },
            { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
    });

    return JSON.parse(res.choices[0].message.content);
};
