import express from "express";
import multer from "multer";
import { transcribeAudio } from "../controllers/transcribe.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

import os from "os";

const router = express.Router();
const upload = multer({ dest: os.tmpdir() }); // Use OS temp dir (works on Vercel)

// POST /api/transcribe
router.post("/", requireAuth, upload.single("audio"), transcribeAudio);

export default router;
