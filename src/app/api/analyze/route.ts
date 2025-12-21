import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
// @ts-ignore
import pdf from "pdf-parse";

export async function POST(req: Request) {
  try {
    const { base64, mimeType } = await req.json();

    if (!base64 || !mimeType) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    console.log("API Key Configured:", !!apiKey);
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Choose model based on input. Gemini 1.5 Flash is good for multimodal and speed.
    // If not available, fallback to gemini-pro (text only) or gemini-pro-vision (images).
    // Safest bet for generic use is "gemini-1.5-flash".
    // Safest bet for generic use is "gemini-1.5-flash".
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let promptParts: any[] = [];
    let textContent = "";

    // Parse PDF on server if possible to save tokens/complexity, or pass as image parts if needed.
    // However, Gemini 1.5 accepts PDF as document parts if using the File API, but via standard generateContent
    // we often pass text or image.
    // For this implementation:
    // 1. If Text/Markdown: Pass raw text.
    // 2. If PDF: Parse text using pdf-parse and pass as text. 
    //    (Images in PDF won't be analyzed this way, but it covers most contracts).
    // 3. If Image: Pass inline data.

    if (mimeType === "application/pdf") {
      try {
        const buffer = Buffer.from(base64, "base64");
        // const pdf = require("pdf-parse");
        const pdfData = await pdf(buffer);
        textContent = pdfData.text;

        // Add text prompt
        promptParts.push({ text: `Analyze the following contract text:\n\n${textContent.substring(0, 50000)}` });
      } catch (e) {
        console.error("PDF Parsing/Import Error:", e);
        return NextResponse.json({ error: "Failed to parse PDF", details: String(e) }, { status: 500 });
      }
    } else if (mimeType.startsWith("image/")) {
      // Image support
      promptParts.push({
        inlineData: {
          data: base64,
          mimeType: mimeType
        }
      });
      promptParts.push({ text: "Analyze the contract shown in this image." });
    } else {
      // Plain text
      const buffer = Buffer.from(base64, "base64");
      textContent = buffer.toString("utf-8");
      promptParts.push({ text: `Analyze the following contract text:\n\n${textContent.substring(0, 30000)}` });
    }

    const systemInstruction = `
      You are an expert legal aide. Analyze the provided contract document.
      
      Required Output Format (JSON):
      {
        "summary": "High-level summary of what this contract is about (2-3 sentences).",
        "key_details": [
           "List of 3-5 crucial details (e.g., Parties involved, Effective Date, Payment Terms, Termination conditions)."
        ],
        "risks": [
          {
            "severity": "High" | "Medium" | "Low",
            "clause": "Quote the specific clause or section title",
            "explanation": "Clear explanation of why this is risky."
          }
        ],
        "score": 1-100 (Integer, 100 = Very Safe/Standard, 0 = Extremely Dangerous)
      }

      Do NOT use Markdown formatting (like \`\`\`json) in the response. Return raw JSON only.
    `;

    // Add system instruction to prompt (or use systemInstruction if model supports it, but simple prompt appending works)
    promptParts.push({ text: systemInstruction });

    const result = await model.generateContent(promptParts);
    const response = await result.response;
    const textResponse = response.text();

    console.log("Raw AI Response:", textResponse); // For debugging

    // Clean up
    const cleanJson = textResponse
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      const parsed = JSON.parse(cleanJson);
      return NextResponse.json(parsed);
    } catch (e) {
      console.error("JSON Parse Error:", e, "Raw:", textResponse);
      // Fallback or error
      return NextResponse.json({
        summary: "Failed to parse AI Key Details.",
        key_details: ["Raw Analysis below:"],
        risks: [{ severity: "Low", clause: "Parsing Error", explanation: cleanJson }],
        score: 0
      });
    }

  } catch (error: any) {
    console.error("Analysis Error JSON:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json({
      summary: "Analysis failed (AI Service Error). Showing placeholder results.",
      key_details: ["Contract Type: Unknown", "Date: Pending", "Parties: Pending"],
      risks: [
        { severity: "Medium", clause: "AI Service Unavailable", explanation: `Error details: ${error.message}. Please check your API Key and Region.` },
        { severity: "Low", clause: "Fallback Mode", explanation: "This is a demonstration result." }
      ],
      score: 50
    });
  }
}
