import rateLimit from "express-rate-limit";

export const aiRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // max 10 AI requests per minute per user
    message: {
        success: false,
        error: "Too many requests. Please slow down.",
        code: "RATE_LIMITED",
    },
    // keyGenerator removed to use default robust IP handling and avoid IPv6 errors
    standardHeaders: true,
    legacyHeaders: false,
});
