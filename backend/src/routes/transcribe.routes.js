import express from "express";
import multer from "multer";
import { transcribeAudio } from "../controllers/transcribe.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// Use memory storage for serverless environments (Vercel) to avoid disk issues
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /api/transcribe
router.post("/", requireAuth, upload.single("audio"), transcribeAudio);

export default router;
