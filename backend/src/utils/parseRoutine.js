import OpenAI from "openai";

let openai;

export const parseRoutine = async (text) => {
    if (!openai) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    try {
        const res = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: `Extract routine details from user input.

ROUTINE vs REMINDER:
- ROUTINE = RECURRING habit (daily, weekly, every Monday, "add a routine")
- REMINDER = ONE-TIME event (tomorrow, next week, January 30th)

Return isRoutine: TRUE if user:
- Says "routine", "habit", "daily", "everyday", "every day", "weekly"
- Says "every morning", "every night", "every Monday"
- Uses "add a routine", "set a routine", "gym routine"
- Says "har din", "roz" (Hindi for everyday)

Return isRoutine: FALSE if user:
- Says "remind me", "reminder", "don't forget"
- Uses specific dates: "tomorrow", "next week", "January 30"
- One-time events

TIME PARSING:
- "morning" = "8:00 AM"
- "evening" = "6:00 PM"
- "night" = "9:00 PM"
- "7 am" = "7:00 AM"
- No time = "8:00 AM" (default)

DAY PARSING:
- "weekdays" = ["Mon", "Tue", "Wed", "Thu", "Fri"]
- "weekends" = ["Sat", "Sun"]
- "everyday" / "daily" = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
- "Monday and Wednesday" = ["Mon", "Wed"]

ICONS (based on activity):
- gym/workout/exercise → "fitness-outline"
- study/read/learn → "book-outline"
- work/office → "briefcase-outline"
- health/medicine → "heart-outline"
- morning/wake up → "sunny-outline"
- night/sleep → "moon-outline"
- breakfast/coffee → "cafe-outline"
- walk/run → "walk-outline"
- water/hydrate → "water-outline"
- music → "musical-notes-outline"
- default → "time-outline"

Return JSON:
{
  "isRoutine": boolean,
  "title": string | null,
  "time": "h:mm AM/PM" (default "8:00 AM"),
  "repeat": "daily" | "weekly" | "custom",
  "selectedDays": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  "icon": string
}`
                },
                { role: "user", content: text },
            ],
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(res.choices[0].message.content);
        console.log("🔄 Parsed Routine:", result);
        return result;
    } catch (error) {
        console.error("Parse Routine Error:", error.message);
        return null;
    }
};
