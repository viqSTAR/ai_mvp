import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        clerkId: {
            type: String,
            required: true,
            unique: true,
        },

        email: {
            type: String,
            required: true,
        },

        role: {
            type: String,
            default: "user",
        },
        dailyAiCount: {
            type: Number,
            default: 0,
        },

        lastAiReset: {
            type: Date,
            default: Date.now,
        },

    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
