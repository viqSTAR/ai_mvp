import { clerkClient } from "@clerk/clerk-sdk-node";
import User from "../models/User.js";

export const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: "No auth header" });
        }

        const token = authHeader.replace("Bearer ", "");

        const session = await clerkClient.verifyToken(token);
        const clerkId = session.sub;

        const user = await User.findOne({ clerkId });
        if (!user) {
            return res.status(401).json({ error: "User not found in MongoDB" });
        }

        req.user = user; // 🔥 MongoDB user available everywhere
        next();
    } catch (err) {
        console.error("Auth error:", err);
        res.status(401).json({ error: "Unauthorized" });
    }
};
