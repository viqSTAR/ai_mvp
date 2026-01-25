import express from "express";
import multer from "multer";
import { transcribeAudio } from "../controllers/transcribe.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // Temp storage

// POST /api/transcribe
router.post("/", requireAuth, upload.single("audio"), transcribeAudio);

export default router;
