
"use strict";

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;
const ROOT = __dirname;

app.disable("x-powered-by");

// Health check: no API key required.
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "Aura Sign",
    mode: "local"
  });
});

// Serve the actual website.
app.get("/", (req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

// Serve the logo used by the website.
app.get("/logo.png", (req, res) => {
  res.sendFile(path.join(ROOT, "logo.png"), (err) => {
    if (err && !res.headersSent) {
      res.status(err.statusCode || 404).send("Logo not found.");
    }
  });
});

// No AI endpoints or external AI requests.
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Aura Sign website running on port ${PORT}`);
});
