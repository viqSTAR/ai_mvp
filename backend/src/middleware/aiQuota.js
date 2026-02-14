const DAILY_FREE_LIMIT = 100; // change anytime

export const aiQuotaCheck = async (req, res, next) => {
    const user = req.user;

    const now = new Date();
    const lastReset = new Date(user.lastAiReset);

    // Reset daily count if day changed
    if (now.toDateString() !== lastReset.toDateString()) {
        user.dailyAiCount = 0;
        user.lastAiReset = now;
        await user.save();
    }

    if (user.dailyAiCount >= DAILY_FREE_LIMIT) {
        return res.status(403).json({
            success: false,
            error: "Daily AI limit reached",
            code: "AI_QUOTA_EXCEEDED",
            limit: DAILY_FREE_LIMIT,
        });
    }

    // increment count
    user.dailyAiCount += 1;
    await user.save();

    next();
};
