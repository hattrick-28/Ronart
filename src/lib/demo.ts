/**
 * Local design preview only. Active when DEMO_DATA=1 and NOT running on Vercel,
 * so it can never switch on in production.
 */
export const IS_DEMO = process.env.DEMO_DATA === "1" && !process.env.VERCEL;
