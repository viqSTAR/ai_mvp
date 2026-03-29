import OpenAI, { toFile } from "openai";

export const transcribeAudio = async (req, res) => {
    try {
        // Initialize OpenAI inside the request to ensure env vars are loaded
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ error: "No audio file provided" });
        }

        try {
            // Transcribe using OpenAI Whisper directly from buffer
            const file = await toFile(req.file.buffer, "audio.m4a", { type: req.file.mimetype || "audio/m4a" });
            const transcription = await openai.audio.transcriptions.create({
                file: file,
                model: "whisper-1",
                language: "en", // Forces roman script output (kaise ho, not कैसे हो)
                prompt: "This is a voice command to an AI assistant app. The user speaks in English and Hindi (Hinglish). Common phrases: set alarm, set reminder, remind me, task, tasks, todo, to-do, checklist, create task, shopping list, add item, add stage, routine, schedule, wake me up, snooze, delete, update, in two minutes, tomorrow morning, yaad rakhna, bhool jao, kaise ho, kya haal hai, mujhe yaad dilao.",
            });

            let text = transcription.text?.trim() || "";

            // Filter out hallucinated garbage (common patterns when audio is silent/noise)
            const suspiciousPatterns = [
                /^MBC$/i,
                /^[가-힣]+$/,  // Pure Korean
                /^[ㄱ-ㅎㅏ-ㅣ]+$/,  // Korean jamo
                /^\.+$/,  // Just dots
                /^[\s\.,!?]+$/,  // Just punctuation
                /^(you|thanks for watching|subscribe|please subscribe)/i,  // YouTube hallucinations
            ];

            const isHallucination = suspiciousPatterns.some(pattern => pattern.test(text)) || text.length < 2;

            if (isHallucination) {
                // Return empty - user was silent
                return res.json({ text: "" });
            }

            res.json({ text });
        } catch (error) {
            if (error.status === 400 && error.message?.includes("Audio length")) {
                // Audio was too short, likely just background noise from continuous listener
                return res.json({ text: "" });
            }
            throw error;
        }
    } catch (error) {
        console.error("Transcription Error:", error);
        res.status(500).json({ error: "Failed to transcribe audio", message: error.message });
    }
};
