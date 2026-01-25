import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { chatWithAI } from "../controllers/chat.controller.js";
import { aiRateLimiter } from "../middleware/aiRateLimit.js";
import { aiQuotaCheck } from "../middleware/aiQuota.js";

const router = express.Router();

router.post(
    "/chat",
    requireAuth,
    aiRateLimiter,
    aiQuotaCheck,
    chatWithAI
);

export default router;
