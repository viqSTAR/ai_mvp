export const chatWithAI = async (req, res) => {
    console.log("✅ MOCK AI ROUTE HIT");
    console.log("User:", req.user);
    console.log("Message:", req.body.message);

    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Message required" });
    }

    res.json({
        success: true,
        data: {
            reply: `🤖 Mock AI reply to: "${message}"`,
        },
    });
};
