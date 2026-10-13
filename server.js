
const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;

function getAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenAI({ apiKey: key });
}

app.get("/", (req, res) => {
  res.json({ status: "Aura Sign backend is running" });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/text-help", async (req, res) => {
  try {
    const { text, language } = req.body || {};

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Enter some text first." });
    }

    if (text.length > 2000) {
      return res.status(400).json({ error: "Text is too long." });
    }

    const ai = getAI();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents:
        "Prepare a concise, educational text analysis for a sign-language learning app. " +
        "Requested sign language: " + String(language || "ISL") + ". " +
        "User text: " + text +
        ". Return the meaning and useful phrase breakdown. " +
        "Do not invent sign animations or claim this is verified sign-language translation."
    });

    res.json({ result: response.text || "" });
  } catch (error) {
    console.error("Gemini request failed:", error.message);
    res.status(500).json({
      error: "The AI request failed. Check the backend logs and API configuration."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Aura Sign backend listening on port ${PORT}`);
});
