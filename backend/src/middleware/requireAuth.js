import { clerkClient } from "@clerk/clerk-sdk-node";
import User from "../models/User.js";

export const requireAuth = async (req, res, next) => {
    try {
        // Custom Auth Bypass for Android Overlay (since Clerk tokens expire in 60s)
        const overlaySecret = req.headers['x-overlay-secret'];
        const validSecret = "viqstar_overlay_secret_999";
        
        if (overlaySecret && overlaySecret === validSecret) {
            const clerkId = req.headers['x-overlay-user-id'];
            if (!clerkId) return res.status(401).json({ error: "Missing overlay user id" });
            
            // Handle anonymous overlay_guest (used when widget is tapped before app login)
            if (clerkId === 'overlay_guest') {
                req.user = {
                    _id: 'overlay_guest',
                    clerkId: 'overlay_guest',
                    dailyAiCount: 0,
                    lastAiReset: new Date(),
                    save: async () => {},
                };
                req.clerkId = 'overlay_guest';
                return next();
            }

            const user = await User.findOne({ clerkId });
            if (!user) return res.status(401).json({ error: "User not found for overlay" });
            
            req.user = user;
            req.clerkId = clerkId;
            return next();
        }

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
        req.clerkId = clerkId; // Fix for controllers using req.clerkId
        next();
    } catch (err) {
        console.error("Auth error:", err);
        res.status(401).json({ error: "Unauthorized", details: err.message });
    }
};
