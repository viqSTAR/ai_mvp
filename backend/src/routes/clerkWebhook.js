import express from "express";
import User from "../models/User.js";

const router = express.Router();

router.post("/clerk", async (req, res) => {
    try {
        console.log("📩 Clerk webhook received");
        console.log(req.body);

        const event = req.body;

        if (event.type === "user.created") {
            const clerkUser = event.data;

            await User.create({
                clerkId: clerkUser.id,
                email: clerkUser.email_addresses[0].email_address,
                role: "user",
            });

            console.log("✅ User saved to MongoDB");
        }

        res.status(200).json({ received: true });
    } catch (err) {
        console.error("❌ Webhook error:", err);
        res.status(500).json({ error: "Webhook failed" });
    }
});

export default router;
