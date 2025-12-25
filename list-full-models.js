const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: ".env.local" });

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY not found in .env");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        const result = await genAI.listModels();
        console.log("Available Models (Full IDs):");
        result.models.forEach((m) => {
            console.log(`${m.name} - ${m.displayName}`);
        });
    } catch (error) {
        console.error("Error listing models:", error);
        if (error.response) {
            console.error("Response data:", error.response.data);
        }
    }
}

listModels();
