import OpenAI from "openai";

let openai;

export const chatWithAI = async (req, res) => {
    if (!openai) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                success: false,
                error: "Messages array is required",
            });
        }

        // 👇 IMPORTANT: limit context size (cost control)
        const limitedMessages = messages.slice(-10);

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a helpful AI assistant. Be concise, short, and straight to the point. Only elaborate if explicitly asked or if the topic is complex.",
                },
                ...limitedMessages,
            ],
            temperature: 0.7,
        });

        const aiMessage = completion.choices[0].message.content;

        return res.json({
            success: true,
            message: aiMessage,
        });
    } catch (error) {
        console.error("AI error:", error);

        return res.status(500).json({
            success: false,
            error: "AI service failed",
        });
    }
};
