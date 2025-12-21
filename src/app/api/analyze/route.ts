import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { OpenAI } from "openai";
// @ts-ignore
import * as pdfParse from "pdf-parse";

export async function POST(req: Request) {
  let textContent = "";

  try {
    const { base64, mimeType } = await req.json();

    if (!base64 || !mimeType) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    console.log("Debug Keys:", {
      openai: openaiApiKey ? `Present (${openaiApiKey.substring(0, 5)}...)` : "Missing",
      gemini: geminiApiKey ? "Present" : "Missing"
    });

    console.log("Request Payload Info:", {
      mimeType,
      base64Length: base64.length
    });

    // Initialize clients
    // Note: OpenAI client will throw if initialized without key if strict, but we pass it explicitly.
    const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
    const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

    // Parse PDF/Text first to get content for OpenAI or Local fallback
    if (mimeType === "application/pdf") {
      try {
        const buffer = Buffer.from(base64, "base64");
        // @ts-ignore
        const pdf = pdfParse.default || pdfParse;
        const pdfData = await pdf(buffer);
        textContent = pdfData.text;
      } catch (e) {
        console.error("PDF Parsing Error:", e);
        return NextResponse.json({ error: "Failed to parse PDF", details: String(e) }, { status: 500 });
      }
    } else if (mimeType.startsWith("image/")) {
      // Images handled downstream
    } else {
      const buffer = Buffer.from(base64, "base64");
      textContent = buffer.toString("utf-8");
    }

    // ---------------------------------------------------------
    // 1. Attempt OpenAI (ChatGPT) if Key Exists
    // ---------------------------------------------------------
    if (openai) {
      console.log("Attempting analysis with OpenAI...");
      try {
        const result = await analyzeWithOpenAI(openai, textContent, base64, mimeType);
        if (result) return NextResponse.json({ ...result, analysis_source: "OpenAI (ChatGPT)" });
      } catch (error: any) {
        console.warn("OpenAI Analysis Failed (Falling back to Gemini):", error.message);
      }
    }

    // ---------------------------------------------------------
    // 2. Attempt Gemini if Key Exists (Fallback)
    // ---------------------------------------------------------
    if (genAI) {
      let promptParts: any[] = [];
      if (textContent) {
        promptParts.push({ text: `Analyze the following contract text:\n\n${textContent.substring(0, 50000)}` });
      } else if (mimeType.startsWith("image/")) {
        promptParts.push({ inlineData: { data: base64, mimeType: mimeType } });
        promptParts.push({ text: "Analyze the contract shown in this image." });
      }

      const systemInstruction = `
          You are an expert legal scholar. Analyze the provided contract document.
          
          Guidelines for your response:
          1. Professionalism: Use formal, precise legal English.
          2. Completeness: Every sentence MUST be finished. Do NOT use "..." or truncate mid-sentence.
          3. Holistic Summary: The summary must capture the document's overall legal purpose and impact (e.g., "This Service Agreement defines the relationship between X and Y..."), not just a preview of the text.
          4. Format: Return valid JSON only.

          Required Output Format (JSON):
          {
            "summary": "Professional narrative summary (2-3 complete sentences).",
            "key_details": [
               "List of 3-5 crucial details in full sentences."
            ],
            "risks": [
              {
                "severity": "High" | "Medium" | "Low",
                "category": "Termination" | "Payment" | "Arbitration" | "Auto-renewal" | "Liability" | "Confidentiality" | "Other",
                "clause": "Title or quote of the clause",
                "explanation": "Professional legal explanation.",
                "simple_explanation": "Plain-English explanation for a non-lawyer.",
                "who_benefits": "User" | "Company" | "Neutral",
                "impact": "Real-world practical consequence for the user.",
                "confidence": 0-100
              }
            ],
            "score": 1-100
          }

          Special instructions: 
          - Flag Red-Flag Patterns: Auto-renewal traps, unilateral termination, and forced arbitration.
          - Use ethical, transparent language.
          - Return RAW JSON only. Do not wrap in markdown blocks.
        `;
      promptParts.push({ text: systemInstruction });

      // Use only models that are known to exist for the current API version
      const modelsToTry = [
        "gemini-1.5-flash"
      ];

      for (const modelName of modelsToTry) {
        try {
          console.log(`Attempting analysis with Gemini model: ${modelName}`);
          const currentModel = genAI.getGenerativeModel({ model: modelName });
          const result = await currentModel.generateContent(promptParts);
          const response = await result.response;
          const textResponse = response.text();

          const cleanJson = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleanJson);
          return NextResponse.json({ ...parsed, analysis_source: `Gemini (${modelName})` });
        } catch (error: any) {
          console.warn(`Gemini Model ${modelName} failed:`, error.message);
        }
      }
    }

    // ---------------------------------------------------------
    // 3. Local Fallback
    // ---------------------------------------------------------
    console.log("All AI models failed (or no keys), falling back to local analysis...");
    const localResult = analyzeLocally(textContent);
    return NextResponse.json({ ...localResult, analysis_source: "Local (Basic Mode)" });

  } catch (error: any) {
    console.error("Analysis Error (Falling back to local):", error);
    return NextResponse.json({ ...analyzeLocally(textContent || ""), analysis_source: "Local (Fallback)" });
  }
}

async function analyzeWithOpenAI(openai: OpenAI, text: string, base64: string, mimeType: string) {
  const systemPrompt = `
      You are an expert legal scholar.
      Analyze the contract and provide ethical, transparent insights.
      Ensure all sentences are complete and professional. No truncations.
      Return valid JSON only:
      {
        "summary": "Professional narrative (2-3 complete sentences).",
        "key_details": ["3-5 crucial details in full sentences"],
        "risks": [{ 
          "severity": "High"|"Medium"|"Low", 
          "category": "Termination"|"Payment"|"Arbitration"|"Auto-renewal"|"Liability"|"Other",
          "clause": "Clause reference", 
          "explanation": "Professional explanation",
          "simple_explanation": "Plain-English simplified explanation",
          "who_benefits": "User"|"Company"|"Neutral",
          "impact": "Practical consequence for the user",
          "confidence": 0-100
        }],
        "score": 1-100
      }
    `;

  let messages: any[] = [{ role: "system", content: systemPrompt }];

  if (text) {
    // Truncate to safe limit for GPT-4o input (approx 128k tokens, sticking to ~50k chars is safe)
    messages.push({ role: "user", content: `Analyze this contract: \n\n${text.substring(0, 50000)} ` });
  } else if (mimeType.startsWith("image/")) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: "Analyze the contract shown in this image." },
        { type: "image_url", image_url: { url: `data:${mimeType}; base64, ${base64} ` } }
      ]
    });
  } else {
    throw new Error("No text or image content for OpenAI");
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o", // Default to robust model
    messages: messages,
    response_format: { type: "json_object" }
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error("Empty OpenAI response");

  return JSON.parse(content);
}

function analyzeLocally(text: string) {
  const risks: any[] = [];
  const details: string[] = [];
  let score = 100;

  const lowerText = (text || "").toLowerCase();

  if (!text || text.length < 50) {
    return {
      summary: "The provided document does not contain sufficient text for a meaningful legal analysis.",
      key_details: ["Insufficient data"],
      risks: [],
      score: 0
    };
  }

  // Contract Type Detection
  let type = "Agreement";
  if (lowerText.includes("non-disclosure") || lowerText.includes("confidentiality")) type = "Non-Disclosure Agreement";
  else if (lowerText.includes("employment") || lowerText.includes("offer letter")) type = "Employment Agreement";
  else if (lowerText.includes("service") || lowerText.includes("master service")) type = "Service Agreement";
  else if (lowerText.includes("lease") || (lowerText.includes("rental") && lowerText.includes("tenant"))) type = "Lease Agreement";
  else if (lowerText.includes("sale") || lowerText.includes("purchase")) type = "Sales Agreement";

  const generatedSummary = `This document appears to be a ${type} governing the legal relationship and obligations between the involved parties.It outlines the specific terms, conditions, and standards expected within this legal framework.`;

  // Helper for professional sentence generation
  const getSnippet = (keyword: string, text: string) => {
    const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
    const start = Math.max(0, text.lastIndexOf(".", idx) + 1);
    const end = Math.min(text.length, text.indexOf(".", idx + 100));
    let snippet = text.substring(start, end).trim();
    if (snippet.length > 200) snippet = snippet.substring(0, 197) + "...";
    return snippet;
  };

  // Improved Detail Extraction
  const dateMatch = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s\d{1,2},?\s\d{4}\b/gi);
  if (dateMatch) {
    details.push(`The contract cites an effective or reference date of ${dateMatch[0]}.`);
  }

  if (lowerText.includes("confidential")) details.push("The document contains strictly defined confidentiality obligations.");
  if (lowerText.includes("payment") || lowerText.includes("fee")) details.push("Financial considerations and fee structures are explicitly outlined.");

  // Professional Risk Heuristics
  const riskKeywords = [
    { word: "indemnify", risk: "Indemnification Obligations", category: "Liability", who_benefits: "Company", explanation: "This clause creates a high financial risk by requiring one party to compensate the other for specified losses or damages.", simple: "You might have to pay for the other company's mistakes or legal fees.", impact: "Potential high out-of-pocket costs in a lawsuit.", severity: "High" },
    { word: "liability", risk: "Limitation of Liability", category: "Liability", who_benefits: "Company", explanation: "A limitation of liability section may restrict your ability to recover full damages in the event of a breach.", simple: "There is a 'cap' on how much you can sue them for, even if they fail completely.", impact: "You cannot recover your full losses if they mess up.", severity: "High" },
    { word: "termination", risk: "Termination Provisions", category: "Termination", who_benefits: "Neutral", explanation: "The agreement includes specific conditions under which the contract may be ended, potentially affecting long-term stability.", simple: "This explains how and when the deal can be ended.", impact: "The specific notice period could leave you stuck or suddenly without service.", severity: "Medium" },
    { word: "arbitration", risk: "Dispute Resolution (Arbitration)", category: "Arbitration", who_benefits: "Company", explanation: "Forced arbitration clauses limit your right to seek judicial relief in a public court of law.", simple: "You can't go to court; you have to use a private judge they might choose.", impact: "Losing the right to a public trial and potentially unbiased jury.", severity: "High" },
    { word: "auto-renew", risk: "Automatic Renewal", category: "Auto-renewal", who_benefits: "Company", explanation: "Contracts that renew without explicit consent can lead to unintended long-term financial commitments.", simple: "This deal keeps going forever unless you remember to cancel it.", impact: "You'll be charged automatically if you miss a deadline.", severity: "Medium" }
  ];

  riskKeywords.forEach(kw => {
    if (lowerText.includes(kw.word)) {
      score -= 15;
      risks.push({
        severity: kw.severity,
        category: kw.category,
        clause: kw.risk,
        explanation: kw.explanation,
        simple_explanation: kw.simple,
        who_benefits: kw.who_benefits,
        impact: kw.impact,
        confidence: 85
      });
    }
  });

  if (score < 0) score = 0;

  return {
    summary: generatedSummary,
    key_details: details.length > 0 ? details : ["General contractual terms detected with standard obligations."],
    risks: risks.length > 0 ? risks : [{ severity: "Low", clause: "General Terms", explanation: "The document uses standard contractual language with no immediate high-risk keyword alerts." }],
    score: score
  };
}
