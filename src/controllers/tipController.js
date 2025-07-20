import { GoogleGenerativeAI } from "@google/generative-ai";
import Tip from "../models/Tip.js"; // Import the Tip model for MongoDB

// Initialize the Gemini AI client. Ensure GEMINI_API_KEY is in your .env file.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generates a new financial tip using the Gemini API.
 * This is the core function that can be called by a cron job or on-demand.
 * @returns {Promise<string>} The generated tip text.
 */
const generateNewTip = async () => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = "Give me a short, unique, and actionable financial pro tip (under 200 characters) for a user of a budgeting application. The tip should be encouraging and easy to understand.";

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        // Return a reliable fallback tip if the API call fails
        return "Reviewing your monthly subscriptions is a great way to find extra savings!";
    }
};

/**
 * This function is designed to be called by a scheduled cron job (e.g., once a day).
 * It generates a new tip and stores it in the database.
 */
export const generateAndStoreNewTip = async () => {
    console.log('Attempting to generate and store a new daily tip...');
    const tipText = await generateNewTip();

    // Get the start of today (midnight) to use as a unique key
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
        // Use findOneAndUpdate with 'upsert' to create the tip if it doesn't exist for today,
        // or update it if the cron job runs multiple times for some reason. This is an atomic operation.
        const newTip = await Tip.findOneAndUpdate({
            generatedOn: today
        }, {
            tipText: tipText,
            generatedOn: today
        }, {
            new: true, // Return the new/updated document
            upsert: true, // Create the document if it doesn't exist
            setDefaultsOnInsert: true
        });

        console.log(`Successfully stored tip for ${today.toDateString()}: "${newTip.tipText}"`);
    } catch (error) {
        console.error("Error storing new tip in MongoDB:", error);
    }
};

/**
 * This is the main controller function for the API endpoint.
 * It fetches today's tip from the database. If it doesn't exist,
 * it generates one on-demand to ensure a tip is always available.
 */
export const getTodaysTip = async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
        let tip = await Tip.findOne({ generatedOn: today });

        // If no tip is found for today (e.g., cron job hasn't run yet), generate one now.
        if (!tip) {
            console.log("No tip found for today. Generating on-demand...");
            const tipText = await generateNewTip();
            tip = await Tip.create({ tipText, generatedOn: today });
            console.log("On-demand tip created and stored.");
        }

        res.status(200).json({
            success: true,
            tip: tip.tipText,
        });

    } catch (error) {
        console.error("Error fetching today's tip:", error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching the pro tip.',
            error: error.message,
        });
    }
};
