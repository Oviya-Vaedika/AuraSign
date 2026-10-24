
"use strict";

const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 10000;

// Optional API key. The server can start without it.
const API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

// Allow requests from your deployed Aura Sign website.
app.use(cors({
  origin: [
    "https://oviya-vaedika.github.io",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "20kb" }));

// Health check: should work even without an API key.
app.get("/", (req, res) => {
  res.status(200).json({
    status: "Aura Sign backend is running",
    aiConfigured: Boolean(ai),
    message: ai
      ? "Backend and AI configuration are ready."
      : "Backend is ready. AI features require an API key."
  });
});

// Additional health check for monitoring.
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

// AI text assistance.
app.post("/api/text-help", async (req, res) => {
  try {
    const text =
      typeof req.body?.text === "string"
        ? req.body.text.trim()
        : "";

    const language =
      typeof req.body?.language === "string"
        ? req.body.language.trim().slice(0, 50)
        : "ISL";

    if (!text) {
      return res.status(400).json({
        error: "Please enter some text."
      });
    }

    if (text.length > 500) {
      return res.status(400).json({
        error: "Text must be 500 characters or fewer."
      });
    }

    if (!ai) {
      return res.status(503).json({
        error:
          "AI translation is not configured yet. The website backend is running, but an API key is needed for this feature."
      });
    }

    const prompt = `
You are a careful assistant for Aura Sign, a sign-language learning project.

The user's selected sign-language mode is: ${language}

User text:
${text}

Explain the likely meaning and how the message could be expressed
in the selected sign language.

Important:
- Do not claim that a word-for-word English translation is a verified
  sign-language translation.
- Do not invent exact signs when you cannot verify them.
- Clearly say when a qualified sign-language source or human review
  is needed.
- This response is text guidance, not a generated sign animation.
- Keep the answer clear and concise.
`;

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: prompt
    });

    const answer =
      typeof result.text === "string" ? result.text.trim() : "";

    if (!answer) {
      return res.status(502).json({
        error: "The AI returned an empty response. Please try again."
      });
    }

    return res.status(200).json({ result: answer });

  } catch (error) {
    console.error(
      "Text-help request failed:",
      error?.message || "Unknown error"
    );

    return res.status(502).json({
      error:
        "The AI service could not complete the request. Please try again later."
    });
  }
});

// Unknown routes return JSON instead of crashing the server.
app.use((req, res) => {
  res.status(404).json({
    error: "API route not found."
  });
});

// Catch malformed JSON.
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      error: "Invalid JSON request."
    });
  }

  console.error("Server error:", err.message);

  return res.status(500).json({
    error: "An unexpected server error occurred."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Aura Sign backend listening on port ${PORT}`);

  if (!API_KEY) {
    console.warn(
      "GEMINI_API_KEY is missing. Backend is running; AI requests are disabled."
    );
  }
});
