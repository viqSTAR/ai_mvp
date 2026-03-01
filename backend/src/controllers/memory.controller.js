import Memory from "../models/Memory.js";
import User from "../models/User.js";

/**
 * GET /api/memory — Fetch all active memories for the user
 */
export const getMemories = async (req, res) => {
    try {
        const userId = req.clerkId;
        const memories = await Memory.find({ userId, active: true })
            .sort({ updatedAt: -1 });

        res.json({ success: true, memories });
    } catch (error) {
        console.error("Get Memories Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch memories" });
    }
};

/**
 * DELETE /api/memory/:id — Soft-delete a specific memory
 */
export const deleteMemory = async (req, res) => {
    try {
        const userId = req.clerkId;
        const { id } = req.params;

        const memory = await Memory.findOneAndUpdate(
            { _id: id, userId },
            { active: false },
            { new: true }
        );

        if (!memory) {
            return res.status(404).json({ success: false, error: "Memory not found" });
        }

        res.json({ success: true, message: "Memory deleted" });
    } catch (error) {
        console.error("Delete Memory Error:", error);
        res.status(500).json({ success: false, error: "Failed to delete memory" });
    }
};

/**
 * DELETE /api/memory — Delete ALL memories for the user
 */
export const deleteAllMemories = async (req, res) => {
    try {
        const userId = req.clerkId;
        await Memory.updateMany({ userId }, { active: false });

        res.json({ success: true, message: "All memories deleted" });
    } catch (error) {
        console.error("Delete All Memories Error:", error);
        res.status(500).json({ success: false, error: "Failed to delete memories" });
    }
};

/**
 * PATCH /api/memory/toggle — Toggle memory collection on/off
 */
export const toggleMemory = async (req, res) => {
    try {
        const userId = req.clerkId;
        const { enabled } = req.body;

        if (typeof enabled !== "boolean") {
            return res.status(400).json({ success: false, error: "enabled (boolean) is required" });
        }

        const user = await User.findOneAndUpdate(
            { clerkId: userId },
            { memoryEnabled: enabled },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        res.json({ success: true, memoryEnabled: user.memoryEnabled });
    } catch (error) {
        console.error("Toggle Memory Error:", error);
        res.status(500).json({ success: false, error: "Failed to toggle memory" });
    }
};

/**
 * GET /api/memory/status — Get memory collection status
 */
export const getMemoryStatus = async (req, res) => {
    try {
        const userId = req.clerkId;
        const user = await User.findOne({ clerkId: userId });

        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        const count = await Memory.countDocuments({ userId, active: true });

        res.json({
            success: true,
            memoryEnabled: user.memoryEnabled !== false, // default true
            memoryCount: count,
        });
    } catch (error) {
        console.error("Memory Status Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch status" });
    }
};
