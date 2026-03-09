import fs from "fs";
import OpenAI from "openai";

export const transcribeAudio = async (req, res) => {
    try {
        // Initialize OpenAI inside the request to ensure env vars are loaded
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        if (!req.file) {
            return res.status(400).json({ error: "No audio file provided" });
        }

        const filePath = req.file.path;
        const newFilePath = `${filePath}.m4a`;

        // Rename file to have extension so OpenAI recognizes it
        fs.renameSync(filePath, newFilePath);

        try {
            // Transcribe using OpenAI Whisper
            const transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(newFilePath),
                model: "whisper-1",
                language: "en", // Forces roman script output (kaise ho, not कैसे हो)
                prompt: "This is a voice command to an AI assistant app. The user speaks in English and Hindi (Hinglish). Common phrases: set alarm, set reminder, remind me, change to alarm, change to notification, schedule, routine, wake me up, snooze, delete, update, in two minutes, tomorrow morning, yaad rakhna, bhool jao, kaise ho, kya haal hai, mujhe yaad dilao.",
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
        } finally {
            // Cleanup: Delete the temp file
            fs.unlink(newFilePath, (err) => {
                if (err) console.error("Error deleting temp file:", err);
            });
        }
    } catch (error) {
        console.error("Transcription Error:", error);
        res.status(500).json({ error: "Failed to transcribe audio" });
    }
};
