import mongoose from "mongoose";

const memorySchema = new mongoose.Schema(
    {
        userId: {
            type: String, // Clerk ID
            required: true,
            index: true,
        },
        category: {
            type: String,
            enum: ["preference", "personal_fact", "habit", "context", "instruction"],
            default: "context",
        },
        content: {
            type: String,
            required: true,
        },
        source: {
            type: String,
            enum: ["chat", "routine", "reminder"],
            default: "chat",
        },
        sourceId: {
            type: String, // optional: conversation ID or schedule item ID
            default: null,
        },
        active: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// Compound index for efficient queries
memorySchema.index({ userId: 1, active: 1, updatedAt: -1 });

const Memory = mongoose.model("Memory", memorySchema);

export default Memory;
