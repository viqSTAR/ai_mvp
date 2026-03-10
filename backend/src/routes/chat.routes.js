import express from "express";
import { chatWithAI, getChatHistory, getChatDetails, syncChatConversation, deleteChatConversation, generateSpeech } from "../controllers/chat.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { aiQuotaCheck } from "../middleware/aiQuota.js";

const router = express.Router();

router.post("/chat", requireAuth, aiQuotaCheck, chatWithAI);
router.post("/chat/tts", requireAuth, aiQuotaCheck, generateSpeech);
router.get("/chat/tts", requireAuth, aiQuotaCheck, generateSpeech);
router.get("/chat/history", requireAuth, getChatHistory);
router.get("/chat/:id", requireAuth, getChatDetails);
router.post("/chat/sync", requireAuth, syncChatConversation);
router.delete("/chat/:id", requireAuth, deleteChatConversation);

export default router;
