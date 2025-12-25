import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { content, targetLanguage } = await req.json();

        if (!content || !targetLanguage) {
            return NextResponse.json({ error: "Content and target language are required" }, { status: 400 });
        }

        const geminiApiKey = process.env.GEMINI_API_KEY;
        console.log("Translation Request:", { targetLanguage, contentPreview: typeof content === 'string' ? content.substring(0, 50) : "Object" });

        if (!geminiApiKey) {
            console.error("Gemini API key is missing in environment variables.");
            return NextResponse.json({ error: "Gemini API key is missing on the server" }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(geminiApiKey);

        const modelsToTry = [
            "gemini-2.0-flash",
            "gemini-flash-latest",
            "gemini-pro-latest",
            "gemini-1.5-flash"
        ];

        let textResponse = "";
        let usedModel = "";

        for (const modelName of modelsToTry) {
            try {
                console.log(`Attempting translation with Gemini model: ${modelName}`);
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        responseMimeType: "application/json",
                    }
                });

                const prompt = `
                    Translate the values in this JSON contract analysis into ${targetLanguage}.
                    Keys to keep exactly the same: "summary", "key_details", "risks", "severity", "category", "clause", "explanation", "simple_explanation", "who_benefits", "impact", "confidence", "score".
                    
                    Rules:
                    1. Translate ONLY the string values.
                    2. Maintain the same JSON structure.
                    3. Do not translate technical keys.
                    4. If a value is a percentage or number, keep it as is.
                    5. Return valid JSON only.
                    
                    JSON to translate:
                    ${JSON.stringify(content)}
                `;

                const result = await model.generateContent(prompt);
                const response = await result.response;
                textResponse = response.text();
                usedModel = modelName;
                break; // Success!
            } catch (modelErr: any) {
                console.warn(`Translation with ${modelName} failed:`, modelErr.message);
                continue; // Try next model
            }
        }

        if (!textResponse) {
            throw new Error("All Gemini models failed for translation.");
        }

        console.log(`Translation successful using model: ${usedModel}`);

        // More robust JSON extraction
        let cleanJson = textResponse.trim();
        const jsonStart = cleanJson.indexOf('{');
        const jsonEnd = cleanJson.lastIndexOf('}');

        if (jsonStart !== -1 && jsonEnd !== -1) {
            cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1);
        }

        try {
            const parsed = JSON.parse(cleanJson);
            return NextResponse.json(parsed);
        } catch (parseError) {
            console.error("JSON Parse Error. Raw response:", textResponse);
            return NextResponse.json({
                error: "Failed to parse translation result",
                details: String(parseError),
                rawResponse: textResponse.substring(0, 500) // Include partial response for debugging
            }, { status: 500 });
        }
    } catch (error: any) {
        console.error("Translation Error:", error);
        return NextResponse.json({ error: "Failed to translate content", details: String(error) }, { status: 500 });
    }
}
