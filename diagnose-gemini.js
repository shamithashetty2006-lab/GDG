const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
require("dotenv").config({ path: ".env.local" });

async function diagnose() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY not found in .env.local");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelsToTest = [
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-2.0-flash",
        "gemini-flash-latest",
        "gemini-pro-latest",
        "models/gemini-1.5-flash",
        "models/gemini-1.5-pro",
        "models/gemini-2.0-flash"
    ];

    console.log("--- Gemini Model Diagnostics ---");

    for (const modelName of modelsToTest) {
        try {
            process.stdout.write(`Testing ${modelName}... `);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Say 'System OK'");
            const response = await result.response;
            const text = response.text();
            console.log(`✅ SUCCESS: ${text.trim()}`);
        } catch (error) {
            console.log(`❌ FAILED: ${error.message.split('\n')[0]}`);
        }
    }
}


diagnose();
