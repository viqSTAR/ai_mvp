import express from "express";
import { chatWithAI, getChatHistory, getChatDetails, syncChatConversation, deleteChatConversation, generateSpeech } from "../controllers/chat.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { aiQuotaCheck } from "../middleware/aiQuota.js";

const router = express.Router();
router.get("/debug-auth", (req, res) => {
    res.json({
        headers: req.headers,
        secret: process.env.OVERLAY_SECRET_KEY,
        test: "viqstar_overlay_secret_999"
    });
});

router.post("/chat", requireAuth, aiQuotaCheck, chatWithAI);
// TTS should not consume separate AI quota; chat endpoint already enforces quota.
router.post("/chat/tts", requireAuth, generateSpeech);
router.get("/chat/tts", requireAuth, generateSpeech);
router.get("/chat/history", requireAuth, getChatHistory);
router.get("/chat/:id", requireAuth, getChatDetails);
router.post("/chat/sync", requireAuth, syncChatConversation);
router.delete("/chat/:id", requireAuth, deleteChatConversation);

export default router;
