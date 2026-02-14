import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getSchedule, updateReminders, updateRoutines } from "../controllers/schedule.controller.js";

const router = express.Router();

router.get("/", requireAuth, getSchedule);
router.post("/reminders", requireAuth, updateReminders);
router.post("/routines", requireAuth, updateRoutines);

export default router;
