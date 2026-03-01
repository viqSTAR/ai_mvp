import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    id: String,
    role: { type: String, enum: ["user", "ai"] },
    text: String,
    type: String, // "file" for attachment-only messages
    attachments: [{
        fileType: String, // "image", "video", "document"
        uri: String,
        name: String,
    }],
    createdAt: Number,
}, { _id: false });

const conversationSchema = new mongoose.Schema(
    {
        userId: {
            type: String, // Clerk ID
            required: true,
            index: true,
        },
        id: {
            type: String, // Frontend generated ID (timestamp)
            required: true,
            unique: true,
        },
        title: {
            type: String,
            default: "New Chat",
        },
        messages: [messageSchema],
    },
    { timestamps: true }
);

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
