import express from "express";
import cors from "cors";
import { requireAuth } from "./middleware/requireAuth.js";
import clerkWebhook from "./routes/clerkWebhook.js";
import chatRoutes from "./routes/chat.routes.js";
import transcribeRoutes from "./routes/transcribe.routes.js";


const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use("/webhook", clerkWebhook);
app.use("/api", chatRoutes);
app.use("/api/transcribe", transcribeRoutes);

app.use(
    cors({
        origin: "*", // for development (RN apps don't have a fixed origin)
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);


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
