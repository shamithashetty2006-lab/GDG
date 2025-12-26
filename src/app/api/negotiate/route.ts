import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { OpenAI } from "openai";

export async function POST(req: Request) {
    try {
        const { clause, explanation, context } = await req.json();

        if (!clause) {
            return NextResponse.json({ error: "No clause provided" }, { status: 400 });
        }

        const openaiApiKey = process.env.OPENAI_API_KEY;
        const geminiApiKey = process.env.GEMINI_API_KEY;

        console.log("Negotiate API Debug:", {
            openai: openaiApiKey ? "Present" : "Missing",
            gemini: geminiApiKey ? "Present" : "Missing",
            clauseLength: clause?.length
        });

        const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
        const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

        const systemPrompt = `
      You are an expert legal negotiator representing the USER. 
      The user is presented with a contract clause they feel is risky or unfair.
      
      Your Goal:
      1. Analyze the original clause.
      2. Suggest a "Safer/More Balanced" version that protects the user's interests while remaining professional and realistic.
      3. Provide a brief explanation (1-2 sentences) of why the suggestion is better.
      4. Suggest a "Counter-Argument" the user can say to the other party.

      Return valid JSON only:
      {
        "original_clause": "The original text",
        "suggested_clause": "The improved version",
        "why_it_is_better": "Explanation of protection",
        "negotiation_tip": "What to say to the other party"
      }
    `;

        const userPrompt = `
      Original Clause: "${clause}"
      Risk Explanation: "${explanation || "None provided"}"
      Contract Type/Context: "${context || "General Agreement"}"
      
      Provide a safer alternative.
    `;

        const modelsToTry = [
            "gemini-2.0-flash",
            "gemini-flash-latest",
            "gemini-pro-latest",
            "gemini-1.5-flash"
        ];

        // 1. Try OpenAI
        if (openai) {
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    response_format: { type: "json_object" }
                });

                const content = completion.choices[0].message.content;
                if (content) return NextResponse.json(JSON.parse(content));
            } catch (err: any) {
                console.warn("OpenAI Negotiation failed:", err.message);
            }
        }

        // 2. Try Gemini Loop
        if (genAI) {
            for (const modelName of modelsToTry) {
                try {
                    console.log(`Attempting negotiation with Gemini model: ${modelName}`);
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const prompt = `${systemPrompt}\n\n${userPrompt}`;
                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    const text = response.text();

                    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
                    return NextResponse.json(JSON.parse(cleanJson));
                } catch (error: any) {
                    console.warn(`Gemini Model ${modelName} failed for negotiation:`, error.message);
                }
            }
        }

        // 3. Last Resort Fallback (Semi-Local)
        return NextResponse.json({
            original_clause: clause,
            suggested_clause: "Pending expert review. (AI Service temporarily unavailable)",
            why_it_is_better: "The AI service is currently at capacity or unavailable. Please review this clause manually.",
            negotiation_tip: "Ask for clarification on the specific terms of this clause while our system is being updated."
        }, { status: 200 }); // Return 200 so UI doesn't crash

    } catch (error: any) {
        console.error("Negotiation Error:", error);
        return NextResponse.json({ error: "Failed to generate negotiation strategy" }, { status: 500 });
    }
}
