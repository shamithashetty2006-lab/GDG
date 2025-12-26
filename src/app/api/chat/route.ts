import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { OpenAI } from "openai";

export async function POST(req: Request) {
    try {
        const { messages, contractText } = await req.json();

        if (!contractText) {
            return NextResponse.json({ error: "No contract content available for chat" }, { status: 400 });
        }

        const openaiApiKey = process.env.OPENAI_API_KEY;
        const geminiApiKey = process.env.GEMINI_API_KEY;

        console.log("Chat API Debug:", {
            openai: openaiApiKey ? "Present" : "Missing",
            gemini: geminiApiKey ? "Present" : "Missing",
            msgCount: messages?.length,
            contractLength: contractText?.length
        });

        const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
        const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

        const systemPrompt = `
      You are an AI Contract Assistant. You are here to help the user understand their contract.
      
      RULES:
      1. ONLY answer questions based on the provided contract text below.
      2. If the answer is not in the contract, say: "I'm sorry, I couldn't find information about that in this specific contract."
      3. Be concise, professional, and helpful.
      4. Use bullet points for lists.
      5. Never give legal advice. Always remind the user to consult with a professional.

      CONTRACT CONTENT:
      """
      ${contractText.substring(0, 50000)}
      """
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
                        ...messages
                    ],
                });

                const content = completion.choices[0].message.content;
                if (content) return NextResponse.json({ message: content });
            } catch (err: any) {
                console.warn("OpenAI Chat failed:", err.message);
            }
        }

        // 2. Try Gemini Loop
        if (genAI) {
            const chatHistory = messages.map((m: any) => ({
                role: m.role === "user" ? "user" : "model",
                parts: [{ text: m.content }]
            }));

            for (const modelName of modelsToTry) {
                try {
                    console.log(`Attempting chat with Gemini model: ${modelName}`);
                    const model = genAI.getGenerativeModel({ model: modelName });

                    const chat = model.startChat({
                        history: [
                            { role: "user", parts: [{ text: systemPrompt }] },
                            { role: "model", parts: [{ text: "Understood. I am ready to answer questions about the contract provided." }] },
                            ...chatHistory.slice(0, -1)
                        ]
                    });

                    const lastMessage = messages[messages.length - 1].content;
                    const result = await chat.sendMessage(lastMessage);
                    const response = await result.response;
                    return NextResponse.json({ message: response.text() });
                } catch (error: any) {
                    console.warn(`Gemini Model ${modelName} failed for chat:`, error.message);
                }
            }
        }

        return NextResponse.json({
            message: "I'm sorry, I'm having trouble connecting to my brain right now. Please try again in a moment or check your internet connection."
        }, { status: 200 });

    } catch (error: any) {
        console.error("Critical Chat API Error:", error);
        return NextResponse.json({
            error: "Failed to process chat message",
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
