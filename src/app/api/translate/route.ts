import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { content, targetLanguage } = await req.json();

        if (!content || !targetLanguage) {
            return NextResponse.json({ error: "Content and target language are required" }, { status: 400 });
        }

        const geminiApiKey = process.env.GEMINI_API_KEY;
        console.log("Translation Request Received:", { targetLanguage, contentKeys: Object.keys(content) });

        if (!geminiApiKey) {
            return NextResponse.json({ error: "Gemini API key is missing on the server" }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(geminiApiKey);

        // Updated model list based on typical availability
        const modelsToTry = [
            "gemini-2.0-flash",
            "gemini-flash-latest",
            "gemini-pro-latest",
            "gemini-1.5-flash"
        ];

        let textResponse = "";
        let usedModel = "";
        const modelErrors: string[] = [];

        // Attempt Full Document Translation
        for (const modelName of modelsToTry) {
            try {
                console.log(`Attempting Full Translation with: ${modelName}`);

                // First try strictly with JSON mode if supported
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: { responseMimeType: "application/json" }
                });

                const prompt = `
                    You are a professional legal translator. 
                    Translate the string values in the following JSON into ${targetLanguage}.
                    
                    CRITICAL RULES:
                    1. Maintain the EXACT same JSON structure and keys.
                    2. Translate ONLY the values for these keys: "summary", "clause", "explanation", "simple_explanation", "impact", "key_details".
                    3. Do NOT translate technical keys like "severity", "category", "who_benefits", "score", or "confidence".
                    4. Return valid JSON only. NO markdown, NO code blocks.
                    
                    JSON to translate:
                    ${JSON.stringify(content)}
                `;

                const result = await model.generateContent(prompt);
                const response = await result.response;
                textResponse = response.text();

                if (textResponse && textResponse.trim()) {
                    usedModel = modelName;
                    break;
                }
            } catch (modelErr: any) {
                console.warn(`${modelName} JSON mode failed:`, modelErr.message);

                // Fallback within the same model: Try without JSON mode (Normal text)
                try {
                    console.log(`Retrying ${modelName} in Normal Mode...`);
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent(`
                        Translate the following legal analysis results into ${targetLanguage}. 
                        Keep the JSON format exactly. Return ONLY the JSON object.
                        
                        ${JSON.stringify(content)}
                    `);
                    const response = await result.response;
                    textResponse = response.text();
                    if (textResponse && textResponse.trim()) {
                        usedModel = modelName;
                        break;
                    }
                } catch (retryErr: any) {
                    modelErrors.push(`${modelName}: ${retryErr.message}`);
                }
            }
        }

        // If all full translations failed, try a Partial Translation (Summary Only)
        if (!textResponse) {
            console.warn("Full translation failed for all models. Attempting Partial Translation (Summary only)...");
            for (const modelName of modelsToTry) {
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent(`Translate this text into ${targetLanguage}: "${content.summary}"`);
                    const response = await result.response;
                    const summaryOnly = response.text();
                    if (summaryOnly) {
                        return NextResponse.json({
                            ...content,
                            summary: summaryOnly,
                            isPartial: true,
                            note: "Partial translation (summary only) due to complexity."
                        });
                    }
                } catch (pErr) {
                    continue;
                }
            }

            return NextResponse.json({
                error: "All Gemini models failed to translate the content.",
                details: modelErrors.join("; ")
            }, { status: 502 });
        }

        // JSON Extraction & Parsing
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
            console.error("Failed to parse AI response as JSON. Content:", textResponse);
            return NextResponse.json({
                error: "Translation was generated but failed to parse correctly.",
                partialText: textResponse.substring(0, 200)
            }, { status: 500 });
        }
    } catch (error: any) {
        console.error("Critical Translation API Error:", error);
        return NextResponse.json({ error: "A server-side error occurred during translation." }, { status: 500 });
    }
}
