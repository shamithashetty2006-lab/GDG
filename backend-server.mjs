import express from "express";
import cors from "cors";
import multer from "multer";
import pdf from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

// Load environment variables for local testing
dotenv.config();

const app = express();
const upload = multer({
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get("/", (req, res) => {
    res.send("ClearSign Backend Running on Render");
});

app.post("/analyze", upload.single("file"), async (req, res) => {
    try {
        let text = req.body.text || "";

        // Handle file upload (Multipart)
        if (req.file) {
            const data = await pdf(req.file.buffer);
            text += "\n" + data.text;
        }
        // Handle base64 payload (Compatibility with your current frontend)
        else if (req.body.base64) {
            const buffer = Buffer.from(req.body.base64, "base64");
            if (req.body.mimeType === "application/pdf") {
                const data = await pdf(buffer);
                text = data.text;
            } else {
                text = buffer.toString("utf-8");
            }
        }

        if (!text.trim()) {
            return res.status(400).json({ error: "No contract content provided. Please upload a file or paste text." });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Using a more robust model
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const systemPrompt = `
      Analyze the following contract and provide a high-quality legal assessment in JSON format.
      JSON structure:
      {
        "summary": "2-3 complete sentences explaining the purpose.",
        "key_details": ["Detail 1", "Detail 2"],
        "risks": [
          {
            "severity": "High"|"Medium"|"Low",
            "category": "Termination"|"Payment"|"Arbitration"|"Auto-renewal"|"Liability"|"Other",
            "clause": "Title of the clause",
            "explanation": "Legal explanation.",
            "simple_explanation": "Plain English version.",
            "who_benefits": "User"|"Company"|"Neutral",
            "impact": "Real-world consequence",
            "confidence": 0-100
          }
        ],
        "score": 0-100
      }
    `;

        const result = await model.generateContent([
            { text: systemPrompt },
            { text: `Contract Content:\n${text.substring(0, 50000)}` }
        ]);

        const response = await result.response;
        const responseText = response.text();

        // Clean up potential markdown formatting in AI response
        const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

        res.json(JSON.parse(cleanJson));
    } catch (err) {
        console.error("Backend Analysis Error:", err);
        res.status(500).json({ error: "Analysis failed. Ensure GEMINI_API_KEY is set correctly." });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
    console.log(`Backend running on port ${PORT}`)
);
