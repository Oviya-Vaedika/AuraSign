
"use strict";

// Aura Sign frontend configuration.
// The API key stays on Render, never in this file.
const BACKEND_URL = "https://aura-sign.onrender.com";

const $ = (id) => document.getElementById(id);

const textTab = $("textTab");
const cameraTab = $("cameraTab");
const textSection = $("textSection");
const cameraSection = $("cameraSection");
const textInput = $("textInput");
const languageSelect = $("languageSelect");
const translateButton = $("translateButton");
const resultText = $("resultText");
const resultNote = $("resultNote");
const speakButton = $("speakButton");
const toast = $("toast");

let toastTimeout;
let cameraStream = null;
let handsModel = null;
let cameraRunning = false;
let cameraBusy = false;
let lastHandStatus = "";
let threeScene = null;
let threeCamera = null;
let threeRenderer = null;
let avatarGroup = null;
let avatarClock = null;
let resizeObserver = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2800);
}

function setResult(message, note = "") {
  resultText.textContent = message;
  resultNote.textContent = note;
  speakButton.disabled = !message.trim();
}

function setMode(mode) {
  const isText = mode === "text";

  textSection.classList.toggle("hidden", !isText);
  cameraSection.classList.toggle("hidden", isText);

  textTab.classList.toggle("active", isText);
  cameraTab.classList.toggle("active", !isText);

  textTab.setAttribute("aria-selected", String(isText));
  cameraTab.setAttribute("aria-selected", String(!isText));

  $("inputHeading").textContent = isText ? "Text to sign" : "Sign to text";
  $("modeStatus").textContent = isText ? "TEXT MODE" : "CAMERA MODE";
}

textTab.addEventListener("click", () => setMode("text"));
cameraTab.addEventListener("click", () => setMode("camera"));

textInput.addEventListener("input", () => {
  $("charCount").textContent = `${textInput.value.length} / 500`;
});

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    textInput.value = button.dataset.example;
    $("charCount").textContent = `${textInput.value.length} / 500`;
    textInput.focus();
  });
});

// Ask the existing Render backend for text-based learning guidance.
translateButton.addEventListener("click", async () => {
  const text = textInput.value.trim();
  const language = languageSelect.value;

  if (!text) {
    showToast("Enter a word or sentence first.");
    textInput.focus();
    return;
  }

  translateButton.disabled = true;
  translateButton.textContent = "Getting AI guidance…";
  $("modeStatus").textContent = "PROCESSING";
  setResult("Connecting to Aura Sign's AI service…",
    "This request sends your text and selected language to your backend.");

  try {
    const response = await fetch(`${BACKEND_URL}/api/text-help`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language })
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      throw new Error("The backend returned an unreadable response.");
    }

    if (!response.ok) {
      throw new Error(data.error || `Backend error (${response.status}).`);
    }

    const guidance = typeof data.result === "string"
      ? data.result.trim()
      : "";

    if (!guidance) {
      throw new Error("The AI returned an empty response.");
    }

    setResult(
      guidance,
      `${language} selected. This is AI-generated text guidance, not a verified sign animation.`
    );
    $("modeStatus").textContent = "RESPONSE READY";
    showToast("AI guidance received.");
  } catch (error) {
    console.error("Aura Sign request failed:", error);
    setResult(
      "We couldn't get AI guidance right now.",
      "Check your internet connection, Render service logs and the /api/text-help endpoint."
    );
    $("modeStatus").textContent = "CONNECTION ERROR";
    showToast(error.message || "Could not connect to the backend.");
  } finally {
    translateButton.disabled = false;
    translateButton.innerHTML = "<span>✦</span> Get AI guidance";
  }
});

// Read the returned text aloud using the browser's speech synthesis.
speakButton.addEventListener("click", () => {
  const text = resultText.textContent.trim();

  if (!text || !("speechSynthesis" in window)) {
    showToast("Speech output is not available in this browser.");
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
});

$("copyButton").addEventListener("click", async () => {
  const text = resultText.textContent.trim();

  if (!text) {
    showToast("There is no result to copy.");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast("Result copied.");
  } catch {
    showToast("Clipboard access failed. Select the result and copy it manually.");
  }
});

$("clearButton").addEventListener("click", () => {
  setResult(
    "Your result will appear here.",
    "The character currently demonstrates an idle animation, not a verified sign-language sequence."
  );
  showToast("Result cleared.");
});

// -------------------- Camera hand detection --------------------

function updateDetection(title, message) {
  $("detectionTitle").textContent = title;
  $("detectionMessage").textContent = message;
}

function clearCameraOverlay() {
  const canvas = $("cameraOverlay");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawHandLandmarks(landmarks) {
  const canvas = $("cameraOverlay");
  const video = $("cameraVideo");
  const ctx = canvas.getContext("2d");

  if (!video.videoWidth || !video.videoHeight) return;

  if (canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;

  // Mirror the overlay to match the mirrored camera preview.
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  ctx.strokeStyle = "#22d3ee";
  ctx.fillStyle = "#a78bfa";
  ctx.lineWidth = Math.max(2, canvas.width / 320);

  const connections = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],[0,17]
  ];

  for (const [a, b] of connections) {
    ctx.beginPath();
    ctx.moveTo(landmarks[a].x * canvas.width,
               landmarks[a].y * canvas.height);
    ctx.lineTo(landmarks[b].x * canvas.width,
               landmarks[b].y * canvas.height);
    ctx.stroke();
  }

  for (const point of landmarks) {
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

async function loadHandsModel() {
  if (handsModel) return handsModel;

  if (typeof Hands === "undefined") {
    throw new Error("The hand-detection library did not load. Refresh the page and try again.");
  }

  handsModel = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  handsModel.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.65,
    minTrackingConfidence: 0.6
  });

  handsModel.onResults((results) => {
    const landmarks = results.multiHandLandmarks?.[0];

    if (landmarks) {
      drawHandLandmarks(landmarks);
      $("cameraLabel").textContent = "HAND DETECTED";

      if (lastHandStatus !== "hand") {
        updateDetection(
          "Hand detected",
          "The camera can see a hand. A trained sign-language recognition model is not connected, so the sign itself cannot yet be translated."
        );
        lastHandStatus = "hand";
      }
    } else {
      clearCameraOverlay();
      $("cameraLabel").textContent = "LOOKING FOR HAND";

      if (lastHandStatus !== "none") {
        updateDetection(
          "No hand detected",
          "Move your hand into the camera frame and make sure the lighting is clear."
        );
        lastHandStatus = "none";
      }
    }
  });

  return handsModel;
}

async function cameraFrameLoop() {
  if (!cameraRunning || cameraBusy) return;

  const video = $("cameraVideo");
  if (video.readyState >= 2) {
    cameraBusy = true;
    try {
      await handsModel.send({ image: video });
    } catch (error) {
      console.error("Hand detection error:", error);
    } finally {
      cameraBusy = false;
    }
  }

  if (cameraRunning) requestAnimationFrame(cameraFrameLoop);
}

$("startCameraButton").addEventListener("click", async () => {
  if (cameraRunning) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    showToast("Camera access requires HTTPS or localhost and a supported browser.");
    return;
  }

  const startButton = $("startCameraButton");
  startButton.disabled = true;
  updateDetection("Starting camera…", "Please allow camera access when prompted.");

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });

    const video = $("cameraVideo");
    video.srcObject = cameraStream;
    await video.play();

    await loadHandsModel();

    cameraRunning = true;
    lastHandStatus = "";
    startButton.disabled = true;
    $("stopCameraButton").disabled = false;
    $("cameraLabel").textContent = "CAMERA ACTIVE";
    $("avatarMode").textContent = "CAMERA MODE";
    updateDetection("Camera active", "Looking for hands…");

    cameraFrameLoop();
  } catch (error) {
    console.error("Could not start camera:", error);
    stopCamera();
    updateDetection(
      "Camera unavailable",
      error.message || "Allow camera permission and try again."
    );
    showToast(error.message || "Could not start camera.");
  } finally {
    startButton.disabled = cameraRunning;
  }
});

function stopCamera() {
  cameraRunning = false;
  cameraBusy = false;

  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  const video = $("cameraVideo");
  video.pause();
  video.srcObject = null;

  clearCameraOverlay();
  $("cameraLabel").textContent = "CAMERA OFF";
  $("startCameraButton").disabled = false;
  $("stopCameraButton").disabled = true;
  $("avatarMode").textContent = "IDLE MODE";

  updateDetection("Camera stopped", "Start the camera whenever you're ready.");
  lastHandStatus = "";
}

$("stopCameraButton").addEventListener("click", stopCamera);

window.addEventListener("pagehide", () => {
  stopCamera();
  if (window.speechSynthesis) window.speechSynthesis.cancel();
});

// -------------------- Procedural 3D character --------------------
// This is a stylised 3D character, not a sign-language animation rig.

function createMaterial(color, roughness = 0.65, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addPart(parent, geometry, material, position, scale) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

function createAvatar() {
  const canvas = $("avatarCanvas");
  const fallback = $("avatarFallback");

  if (!window.THREE) {
    fallback.innerHTML = "<span>3D library unavailable</span>";
    return;
  }

  try {
    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color("#0c1020");

    threeCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    threeCamera.position.set(0, 1.35, 5.6);
    threeCamera.lookAt(0, 1.1, 0);

    threeRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    threeRenderer.outputColorSpace = THREE.SRGBColorSpace;

    threeScene.add(new THREE.HemisphereLight(0xdde7ff, 0x24133f, 2));

    const keyLight = new THREE.DirectionalLight(0xffffff, 3);
    keyLight.position.set(3, 5, 4);
    threeScene.add(keyLight);

    const rimLight = new THREE.PointLight(0x22d3ee, 22, 10);
    rimLight.position.set(-2, 2.5, -2);
    threeScene.add(rimLight);

    avatarGroup = new THREE.Group();
    threeScene.add(avatarGroup);

    const skin = createMaterial("#b87962");
    const skinLight = createMaterial("#d89b7c");
    const shirt = createMaterial("#6550c9", 0.45);
    const shirtLight = createMaterial("#8b5cf6", 0.4);
    const hair = createMaterial("#20182f");
    const pants = createMaterial("#25324f");
    const eyes = createMaterial("#f6f7ff");
    const dark = createMaterial("#171426");

    // Body and neck
    addPart(avatarGroup, new THREE.CapsuleGeometry(0.42, 0.58, 5, 12),
      shirt, [0, 1.12, 0], [1, 1, 0.75]);
    addPart(avatarGroup, new THREE.CylinderGeometry(0.12, 0.13, 0.22, 16),
      skin, [0, 1.67, 0]);

    // Head and hair
    addPart(avatarGroup, new THREE.SphereGeometry(0.37, 28, 22),
      skinLight, [0, 2.02, 0]);
    addPart(avatarGroup, new THREE.SphereGeometry(0.375, 24, 18),
      hair, [0, 2.22, -0.035], [1.02, 0.65, 0.98]);

    // Eyes and smile
    addPart(avatarGroup, new THREE.SphereGeometry(0.045, 12, 10),
      dark, [-0.125, 2.04, 0.327]);
    addPart(avatarGroup, new THREE.SphereGeometry(0.045, 12, 10),
      dark, [0.125, 2.04, 0.327]);

    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.012, 8, 20, Math.PI),
      dark
    );
    smile.position.set(0, 1.91, 0.345);
    smile.rotation.z = Math.PI;
    avatarGroup.add(smile);

    // Shoulders, arms and hands
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.42, 1.42, 0);
    avatarGroup.add(leftArm);

    addPart(leftArm, new THREE.CapsuleGeometry(0.105, 0.36, 4, 10),
      shirtLight, [0, -0.24, 0], [1, 1, 1]);
    addPart(leftArm, new THREE.SphereGeometry(0.105, 14, 12),
      skin, [0, -0.49, 0.015]);
    addPart(leftArm, new THREE.SphereGeometry(0.115, 14, 12),
      skinLight, [0, -0.57, 0.045], [1, 1, 0.65]);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.42, 1.42, 0);
    avatarGroup.add(rightArm);

    addPart(rightArm, new THREE.CapsuleGeometry(0.105, 0.36, 4, 10),
      shirtLight, [0, -0.24, 0], [1, 1, 1]);
    addPart(rightArm, new THREE.SphereGeometry(0.105, 14, 12),
      skin, [0, -0.49, 0.015]);
    addPart(rightArm, new THREE.SphereGeometry(0.115, 14, 12),
      skinLight, [0, -0.57, 0.045], [1, 1, 0.65]);

    // Legs
    addPart(avatarGroup, new THREE.CapsuleGeometry(0.16, 0.5, 4, 10),
      pants, [-0.19, 0.35, 0], [1, 1, 1]);
    addPart(avatarGroup, new THREE.CapsuleGeometry(0.16, 0.5, 4, 10),
      pants, [0.19, 0.35, 0], [1, 1, 1]);

    addPart(avatarGroup, new THREE.BoxGeometry(0.28, 0.12, 0.42),
      dark, [-0.19, 0.04, 0.07]);
    addPart(avatarGroup, new THREE.BoxGeometry(0.28, 0.12, 0.42),
      dark, [0.19, 0.04, 0.07]);

    // Glowing floor ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.012, 8, 80),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.04;
    ring.scale.set(1.15, 1, 1);
    avatarGroup.add(ring);

    fallback.classList.add("hidden");

    const clock = new THREE.Clock();
    avatarClock = clock;

    function resizeAvatar() {
      const width = canvas.clientWidth || 500;
      const height = canvas.clientHeight || 360;

      threeRenderer.setSize(width, height, false);
      threeCamera.aspect = width / height;
      threeCamera.updateProjectionMatrix();
    }

    resizeAvatar();

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(resizeAvatar);
      resizeObserver.observe($("avatarStage"));
    } else {
      window.addEventListener("resize", resizeAvatar);
    }

    function animate() {
      requestAnimationFrame(animate);
      if (!threeRenderer || !avatarGroup) return;

      const t = clock.getElapsedTime();
      avatarGroup.position.y = Math.sin(t * 1.2) * 0.025;
      avatarGroup.rotation.y = Math.sin(t * 0.45) * 0.12;
      leftArm.rotation.z = Math.sin(t * 1.1) * 0.035;
      rightArm.rotation.z = -Math.sin(t * 1.1) * 0.035;

      threeRenderer.render(threeScene, threeCamera);
    }

    animate();
  } catch (error) {
    console.error("3D avatar could not start:", error);
    fallback.classList.remove("hidden");
    fallback.innerHTML = "<span>Could not load the 3D character. Try refreshing the page.</span>";
  }
}

createAvatar();
