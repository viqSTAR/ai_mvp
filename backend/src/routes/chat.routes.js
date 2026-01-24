import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { chatWithAI } from "../controllers/chat.controller.js";

const router = express.Router();

router.post("/chat", requireAuth, chatWithAI);

export default router;
