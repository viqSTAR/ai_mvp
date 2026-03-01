import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import User from "../models/User.js";

const router = express.Router();

router.post("/complete-profile", requireAuth, async (req, res) => {
    try {
        const userId = req.user._id;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { profileCompleted: true },
            { new: true }
        );

        res.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error("Complete Profile Error:", error);
        res.status(500).json({ error: "Failed to mark profile as complete" });
    }
});

// Used by AppNavigator to check sync status
router.get("/me", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json({
            success: true,
            data: {
                id: user._id,
                email: user.email,
                role: user.role,
                profileCompleted: user.profileCompleted || false
            }
        });
    } catch (error) {
        console.error("Get Me Error:", error);
        res.status(500).json({ error: "Failed to fetch user profile" });
    }
});

export default router;
