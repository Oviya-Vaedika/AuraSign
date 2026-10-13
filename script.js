"use strict";

const BACKEND_URL = "https://aura-sign.onrender.com";
const $ = (id) => document.getElementById(id);

let toastTimer;
let cameraStream = null;
let handsModel = null;
let aslModel = null;
let aslScaler = null;
let aslModelLoading = false;
let aslModelError = "";
let lastPredictedLabel = "";
let lastPredictionTime = 0;
let cameraRunning = false;
let processingFrame = false;
let lastDetection = "";
let threeRenderer = null;
let threeScene = null;
let threeCamera = null;
let avatarGroup = null;
let resizeObserver = null;

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function setResult(text, note) {
  $("resultText").textContent = text;
  $("resultNote").textContent = note || "";
}

function setMode(mode) {
  const textMode = mode === "text";

  $("textTab").classList.toggle("active", textMode);
  $("cameraTab").classList.toggle("active", !textMode);
  $("textTab").setAttribute("aria-selected", String(textMode));
  $("cameraTab").setAttribute("aria-selected", String(!textMode));

  $("textSection").classList.toggle("hidden", !textMode);
  $("cameraSection").classList.toggle("hidden", textMode);
  $("avatarPanel").classList.toggle("hidden", !textMode);

  $("inputHeading").textContent = textMode ? "Text to sign" : "Sign to text";
  $("modeStatus").textContent = textMode ? "TEXT MODE" : "CAMERA MODE";

  if (!textMode) {
    stopCamera();
    $("avatarMode").textContent = "IDLE MODE";
  }
}

$("textTab").addEventListener("click", () => setMode("text"));
$("cameraTab").addEventListener("click", () => setMode("camera"));

$("textInput").addEventListener("input", () => {
  $("charCount").textContent = `${$("textInput").value.length} / 500`;
});

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    $("textInput").value = button.dataset.example;
    $("charCount").textContent = `${$("textInput").value.length} / 500`;
  });
});

$("translateButton").addEventListener("click", async () => {
  const text = $("textInput").value.trim();
  const language = $("languageSelect").value;
  const button = $("translateButton");

  if (!text) {
    showToast("Enter a message first.");
    $("textInput").focus();
    return;
  }

  button.disabled = true;
  button.textContent = "Processing…";
  $("modeStatus").textContent = "PROCESSING";

  setResult("Processing your request…", "Waiting for the Aura Sign backend.");

  try {
    const response = await fetch(`${BACKEND_URL}/api/text-help`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language, task: "sign_translation" })
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("The backend did not return valid JSON.");
    }

    if (!response.ok) {
      throw new Error(data.error || `Server error ${response.status}`);
    }

    const answer = typeof data.result === "string" ? data.result.trim() : "";
    if (!answer) throw new Error("The AI returned an empty response.");

    setResult(
      answer,
      "AI text response received. Verified sign animations are not yet connected."
    );
    $("modeStatus").textContent = "RESPONSE RECEIVED";
  } catch (error) {
    console.error("Aura Sign backend error:", error);
    setResult(
      "Translation service unavailable.",
      "Check the Render logs and the /api/text-help endpoint."
    );
    $("modeStatus").textContent = "CONNECTION ERROR";
    showToast(error.message || "Could not connect to AI.");
  } finally {
    button.disabled = false;
    button.textContent = "✦ Translate to Sign";
  }
});

$("copyButton").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("resultText").textContent);
    showToast("Result copied.");
  } catch {
    showToast("Copy failed. Select the result and copy it manually.");
  }
});

$("clearButton").addEventListener("click", () => {
  setResult(
    "Enter a message and select Translate to Sign.",
    "Verified sign animations have not been connected yet."
  );
});

$("speakButton").addEventListener("click", () => {
  const text = $("resultText").textContent.trim();
  if (!text || !("speechSynthesis" in window)) {
    showToast("Speech is not available in this browser.");
    return;
  }
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
});

function detectionStatus(title, message) {
  $("detectionTitle").textContent = title;
  $("detectionMessage").textContent = message;
}

function clearOverlay() {
  const canvas = $("cameraOverlay");
  if (!canvas) return;
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
}

function drawLandmarks(points) {
  const video = $("cameraVideo");
  const canvas = $("cameraOverlay");

  if (!video.videoWidth || !video.videoHeight) return;

  if (canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  ctx.strokeStyle = "#22d3ee";
  ctx.fillStyle = "#a78bfa";
  ctx.lineWidth = Math.max(2, canvas.width / 320);

  const lines = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],[0,17]
  ];

  for (const [a, b] of lines) {
    ctx.beginPath();
    ctx.moveTo(points[a].x * canvas.width, points[a].y * canvas.height);
    ctx.lineTo(points[b].x * canvas.width, points[b].y * canvas.height);
    ctx.stroke();
  }

  for (const point of points) {
    ctx.beginPath();
    ctx.arc(
      point.x * canvas.width,
      point.y * canvas.height,
      Math.max(3, canvas.width / 150),
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.restore();
}
