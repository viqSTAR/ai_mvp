import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
    getMemories,
    deleteMemory,
    deleteAllMemories,
    toggleMemory,
    getMemoryStatus,
} from "../controllers/memory.controller.js";

const router = express.Router();

router.get("/", requireAuth, getMemories);
router.get("/status", requireAuth, getMemoryStatus);
router.patch("/toggle", requireAuth, toggleMemory);
router.delete("/:id", requireAuth, deleteMemory);
router.delete("/", requireAuth, deleteAllMemories);

export default router;
