import Schedule from "../models/Schedule.js";

// Get both reminders and routines
export const getSchedule = async (req, res) => {
    try {
        const userId = req.clerkId;
        let schedule = await Schedule.findOne({ userId });

        if (!schedule) {
            // Create default empty schedule if none exists
            schedule = await Schedule.create({ userId, reminders: [], routines: [] });
        }

        res.json({
            reminders: schedule.reminders || [],
            routines: schedule.routines || [],
        });
    } catch (error) {
        console.error("Get Schedule Error:", error);
        res.status(500).json({ error: "Failed to fetch schedule" });
    }
};

// Update Reminders List
export const updateReminders = async (req, res) => {
    try {
        const userId = req.clerkId;
        const { items } = req.body; // Expecting { items: [...] }

        const schedule = await Schedule.findOneAndUpdate(
            { userId },
            { $set: { reminders: items } },
            { new: true, upsert: true } // Create if doesn't exist
        );

        res.json({ success: true, reminders: schedule.reminders });
    } catch (error) {
        console.error("Update Reminders Error:", error);
        res.status(500).json({ error: "Failed to update reminders" });
    }
};

// Update Routines List
export const updateRoutines = async (req, res) => {
    try {
        const userId = req.clerkId;
        const { items } = req.body;

        const schedule = await Schedule.findOneAndUpdate(
            { userId },
            { $set: { routines: items } },
            { new: true, upsert: true }
        );

        res.json({ success: true, routines: schedule.routines });
    } catch (error) {
        console.error("Update Routines Error:", error);
        res.status(500).json({ error: "Failed to update routines" });
    }
};
