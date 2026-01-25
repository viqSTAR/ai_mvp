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
            });

            res.json({ text: transcription.text });
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
