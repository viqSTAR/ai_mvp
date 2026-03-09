import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "./middleware/requireAuth.js";
import clerkWebhook from "./routes/clerkWebhook.js";
import chatRoutes from "./routes/chat.routes.js";
import transcribeRoutes from "./routes/transcribe.routes.js";
import scheduleRoutes from "./routes/schedule.routes.js";
import memoryRoutes from "./routes/memory.routes.js";
import userRoutes from "./routes/user.routes.js";
import { connectDB } from "./config/db.js";

connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Required for express-rate-limit when running behind proxies like ngrok
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

app.use(
    cors({
        origin: "*", // for development (RN apps don't have a fixed origin)
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);
app.use(express.json({ limit: "50mb" }));

// Force-download route (triggers browser download)
app.get("/files/download/:filename", (req, res) => {
    const filePath = path.join(__dirname, "../uploads/generated", req.params.filename);
    const fileName = req.params.filename;
    res.download(filePath, fileName, (err) => {
        if (err) res.status(404).json({ error: "File not found" });
    });
});

// Serve generated files (PDFs, images, docs) for inline viewing
app.use("/files", express.static(path.join(__dirname, "../uploads/generated")));

app.use("/webhook", clerkWebhook);
app.use("/api", chatRoutes);
app.use("/api/transcribe", transcribeRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/memory", memoryRoutes);
app.use("/api/user", userRoutes);


app.get("/", (req, res) => {
    res.send("AI MVP Backend Running 🧠");
});

app.get("/protected", requireAuth, (req, res) => {
    res.json({
        message: "You are authenticated 🎉",
        clerkId: req.clerkId,
    });
});

app.get("/me", requireAuth, (req, res) => {
    res.json({
        success: true,
        data: {
            id: req.user._id,
            email: req.user.email,
            role: req.user.role,
        },
    });
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: Date.now(),
    });
});

app.get("/test-openai", async (req, res) => {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: "hello" }],
        });

        res.json({ ok: true, reply: response.choices[0].message.content });
    } catch (err) {
        res.json({ error: err.message });
    }
});



export default app;
