import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
// @ts-ignore
import * as pdfParse from "pdf-parse";

export async function POST(req: Request) {
  let textContent = "";

  try {
    const { base64, mimeType } = await req.json();

    if (!base64 || !mimeType) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

    // robust fallback mechanism
    const modelsToTry = [
      "gemini-2.0-flash",
      "gemini-2.0-flash-exp",
      "gemini-1.5-flash",
      "gemini-1.5-flash-001",
      "gemini-pro"
    ];

    let promptParts: any[] = [];

    if (mimeType === "application/pdf") {
      try {
        const buffer = Buffer.from(base64, "base64");
        // @ts-ignore
        const pdf = pdfParse.default || pdfParse;
        const pdfData = await pdf(buffer);
        textContent = pdfData.text;

        promptParts.push({ text: `Analyze the following contract text:\n\n${textContent.substring(0, 50000)}` });
      } catch (e) {
        console.error("PDF Parsing/Import Error:", e);
        return NextResponse.json({ error: "Failed to parse PDF", details: String(e) }, { status: 500 });
      }
    } else if (mimeType.startsWith("image/")) {
      promptParts.push({
        inlineData: {
          data: base64,
          mimeType: mimeType
        }
      });
      promptParts.push({ text: "Analyze the contract shown in this image." });
    } else {
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

    promptParts.push({ text: systemInstruction });

    // Execute with fallback
    if (genAI) {
      for (const modelName of modelsToTry) {
        try {
          console.log(`Attempting analysis with model: ${modelName}`);
          const currentModel = genAI.getGenerativeModel({ model: modelName });
          const result = await currentModel.generateContent(promptParts);
          const response = await result.response;
          const textResponse = response.text();
          console.log("Raw AI Response:", textResponse);

          const cleanJson = textResponse
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

          try {
            const parsed = JSON.parse(cleanJson);
            return NextResponse.json(parsed);
          } catch (e) {
            console.error("JSON Parse Error:", e);
            // Don't error out completely, maybe next model works? 
            // Actually usually JSON error means model worked but output bad. 
            // We can treat this as a failure and try next model or just return local analysis.
            throw new Error("JSON invalid");
          }
        } catch (error: any) {
          console.warn(`Model ${modelName} failed:`, error.message);
        }
      }
    }

    console.log("All AI models failed (or no key), falling back to local analysis...");
    const localResult = analyzeLocally(textContent);
    return NextResponse.json(localResult);

  } catch (error: any) {
    console.error("Analysis Error (Falling back to local):", error);
    return NextResponse.json(analyzeLocally(textContent || ""));
  }
}

function analyzeLocally(text: string) {
  const risks: any[] = [];
  const details: string[] = [];
  let score = 100;

  const lowerText = (text || "").toLowerCase();

  if (!text || text.length < 50) {
    return {
      summary: "Document appears to be too short or empty to analyze.",
      key_details: [],
      risks: [],
      score: 0
    };
  }

  // Match dates
  const dateMatch = text.match(/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s\d{1,2},?\s\d{4}\b/gi);
  if (dateMatch) {
    const uniqueDates = Array.from(new Set(dateMatch)).slice(0, 3);
    details.push(`Mentioned Dates: ${uniqueDates.join(", ")}`);
  }

  // Match money
  const moneyMatch = text.match(/[$€£]\s?\d{1,3}(,\d{3})*(\.\d{2})?|(\d+)\s(dollars|euros|pounds)/gi);
  if (moneyMatch) {
    const uniqueMoney = Array.from(new Set(moneyMatch)).slice(0, 3);
    details.push(`Financial Figures: ${uniqueMoney.join(", ")}`);
  }

  // Risk Keywords
  const riskKeywords = [
    { word: "indemnify", risk: "Indemnification obligation", severity: "High" },
    { word: "termination", risk: "Termination clause present", severity: "Medium" },
    { word: "liability", risk: "Liability limitation mentioned", severity: "High" },
    { word: "arbitration", risk: "Forced arbitration clause", severity: "High" },
    { word: "confidential", risk: "Confidentiality requirements", severity: "Medium" },
    { word: "penalty", risk: "Penalty clauses detected", severity: "Medium" },
    { word: "jurisdiction", risk: "Specific jurisdiction defined", severity: "Low" }
  ];

  riskKeywords.forEach(kw => {
    if (lowerText.includes(kw.word)) {
      score -= 10;
      const idx = lowerText.indexOf(kw.word);
      const start = Math.max(0, text.lastIndexOf(".", idx) + 1);
      const end = Math.min(text.length, text.indexOf(".", idx + 50));
      const snippet = text.substring(start, end).trim();

      risks.push({
        severity: kw.severity,
        clause: kw.risk,
        explanation: `Found keyword "${kw.word}": "${snippet.substring(0, 150)}..."`
      });
    }
  });

  if (score < 0) score = 0;

  // Generate a better summary from content
  let generatedSummary = "Basic Analysis (AI Unavailable): No text content could be extracted.";
  if (text && text.length > 0) {
    // Take the first 300 characters or the first paragraph
    const summaryEnd = text.indexOf('\n\n') > 50 ? text.indexOf('\n\n') : 300;
    generatedSummary = "Content Preview: " + text.substring(0, summaryEnd).substring(0, 300).replace(/\s+/g, " ").trim() + "...";
  }

  return {
    summary: generatedSummary,
    key_details: details.length > 0 ? details : ["No specific dates or financial figures found."],
    risks: risks.length > 0 ? risks : [{ severity: "Low", clause: "No obvious keywords found", explanation: "Standard keyword scan returned no matches." }],
    score: score
  };
}
