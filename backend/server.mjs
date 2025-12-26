import express from "express";
import cors from "cors";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

dotenv.config();

const app = express();
const upload = multer({
    limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get("/", (req, res) => {
    res.send("ClearSign Backend Running");
});

app.post("/analyze", upload.single("file"), async (req, res) => {
    try {
        let text = req.body.text || "";

        if (req.file) {
            const data = await pdf(req.file.buffer);
            text += "\n" + data.text;
        } else if (req.body.base64) {
            const buffer = Buffer.from(req.body.base64, "base64");
            if (req.body.mimeType === "application/pdf") {
                const data = await pdf(buffer);
                text = data.text;
            } else {
                text = buffer.toString("utf-8");
            }
        }

        if (!text.trim()) {
            return res.status(400).json({ error: "No contract content provided" });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const modelsToTry = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-pro-latest", "gemini-1.5-flash"];

        const systemPrompt = `Analyze the following contract and provide JSON assessment...`;
        let result;

        for (const modelName of modelsToTry) {
            try {
                console.log(`Backend attempting analysis with Gemini model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });
                result = await model.generateContent([
                    { text: systemPrompt },
                    { text: `Contract Content:\n${text.substring(0, 50000)}` }
                ]);
                break; // Success
            } catch (error) {
                console.warn(`Backend Gemini Model ${modelName} failed:`, error.message);
                continue;
            }
        }

        if (!result) throw new Error("All Gemini models failed in backend");

        const response = await result.response;
        const cleanJson = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        res.json(JSON.parse(cleanJson));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Analysis failed" });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
