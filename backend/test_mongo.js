import mongoose from "mongoose";
import dotenv from "dotenv";
import Conversation from "./src/models/Conversation.js";

dotenv.config();

const testMongo2 = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const chat = await Conversation.findOne().sort({ updatedAt: -1 });

        if (!chat) return;

        // Let's print exactly what the API would send down in getChatDetails
        const rawJson = chat.toJSON();

        const lastMsg = rawJson.messages[rawJson.messages.length - 1];
        console.log("JSON mapping of last msg payload sent by API:");
        console.log(JSON.stringify(lastMsg, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
};

testMongo2();
