import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
    id: String,
    title: String,
    type: { type: String, enum: ["routine", "reminder"] },
    time: String,
    date: String,
    repeat: String,
    selectedDays: [String],
    notificationEnabled: Boolean,
    alarmEnabled: Boolean,
    completed: Boolean,
    icon: String,
}, { _id: false });

const scheduleSchema = new mongoose.Schema(
    {
        userId: {
            type: String, // Clerk ID
            required: true,
            unique: true, // One schedule doc per user
        },
        reminders: [itemSchema],
        routines: [itemSchema],
    },
    { timestamps: true }
);

const Schedule = mongoose.model("Schedule", scheduleSchema);

export default Schedule;
