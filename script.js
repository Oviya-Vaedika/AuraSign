
"use strict";

const BACKEND_URL = "https://aura-sign.onrender.com";
const $ = (id) => document.getElementById(id);

let toastTimer;
let cameraStream = null;
let handsModel = null;
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

  // IMPORTANT: hide the entire avatar panel in Sign → Text mode.
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

// AI text processing. This endpoint does not supply actual sign animations.
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

  setResult(
    "Processing your request…",
    "Waiting for the Aura Sign backend."
  );

  try {
    const response = await fetch(`${BACKEND_URL}/api/text-help`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        language,
        task: "sign_translation"
      })
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

    const answer = typeof data.result === "string"
      ? data.result.trim()
      : "";

    if (!answer) {
      throw new Error("The AI returned an empty response.");
    }

    setResult(
      answer,
      "AI text response received. A verified sign sequence and matching avatar animations are not yet connected."
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

// ---------------- CAMERA + HAND LANDMARK DETECTION ----------------

function detectionStatus(title, message) {
  $("detectionTitle").textContent = title;
  $("detectionMessage").textContent = message;
}

function clearOverlay() {
  const canvas = $("cameraOverlay");
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

  // Mirror the landmarks to match the mirrored video.
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

async function initialiseHandDetector() {
  if (handsModel) return handsModel;

  if (typeof Hands === "undefined") {
    throw new Error("MediaPipe failed to load. Check your internet connection and refresh.");
  }

  handsModel = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  handsModel.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  handsModel.onResults((results) => {
    const points = results.multiHandLandmarks?.[0];

    if (points) {
      drawLandmarks(points);
      $("cameraLabel").textContent = "HAND DETECTED";

      if (lastDetection !== "hand") {
        detectionStatus(
          "Hand detected",
          "Hand landmarks are visible. This version does not yet identify the sign or translate it into words."
        );
        $("recognisedText").textContent =
          "Hand detected — sign recognition model not connected.";
        lastDetection = "hand";
      }
    } else {
      clearOverlay();
      $("cameraLabel").textContent = "LOOKING FOR HAND";

      if (lastDetection !== "none") {
        detectionStatus(
          "No hand detected",
          "Keep your hand inside the camera frame and try brighter lighting."
        );
        lastDetection = "none";
      }
    }
  });

  return handsModel;
}

async function frameLoop() {
  if (!cameraRunning) return;

  if (!processingFrame && $("cameraVideo").readyState >= 2) {
    processingFrame = true;
    try {
      await handsModel.send({ image: $("cameraVideo") });
    } catch (error) {
      console.error("Hand detection frame error:", error);
      detectionStatus("Detection error", "The hand detector could not process this frame.");
    } finally {
      processingFrame = false;
    }
  }

  if (cameraRunning) requestAnimationFrame(frameLoop);
}

$("startCameraButton").addEventListener("click", async () => {
  if (cameraRunning) return;

  const button = $("startCameraButton");
  button.disabled = true;
  detectionStatus("Starting camera…", "Allow camera permission when prompted.");

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera requires HTTPS or localhost in a supported browser.");
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });

    const video = $("cameraVideo");
    video.srcObject = cameraStream;
    await video.play();

    await initialiseHandDetector();

    cameraRunning = true;
    lastDetection = "";
    $("stopCameraButton").disabled = false;
    $("cameraLabel").textContent = "CAMERA ACTIVE";

    detectionStatus("Camera active", "Looking for hands…");
    frameLoop();
  } catch (error) {
    console.error("Camera startup failed:", error);
    stopCamera();
    detectionStatus("Camera unavailable", error.message);
    showToast(error.message || "Could not start the camera.");
  } finally {
    button.disabled = cameraRunning;
  }
});

function stopCamera() {
  cameraRunning = false;
  processingFrame = false;

  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  const video = $("cameraVideo");
  if (video) {
    video.pause();
    video.srcObject = null;
  }

  clearOverlay();

  if ($("cameraLabel")) $("cameraLabel").textContent = "CAMERA OFF";
  if ($("startCameraButton")) $("startCameraButton").disabled = false;
  if ($("stopCameraButton")) $("stopCameraButton").disabled = true;

  lastDetection = "";
}

$("stopCameraButton").addEventListener("click", () => {
  stopCamera();
  detectionStatus("Camera stopped", "Start the camera when you are ready.");
});

$("clearRecognisedButton").addEventListener("click", () => {
  $("recognisedText").textContent = "No sign recognised yet.";
});

$("speakRecognisedButton").addEventListener("click", () => {
  const text = $("recognisedText").textContent.trim();

  if (!text || text === "No sign recognised yet.") {
    showToast("There is no recognised text to speak.");
    return;
  }

  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
});

window.addEventListener("pagehide", stopCamera);

// ------------------- 3D AVATAR PREVIEW -------------------
// This creates a stylised idle character, not a sign-language rig.

function createPart(parent, geometry, material, position, scale) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

function createAvatar() {
  const fallback = $("avatarFallback");

  if (!window.THREE) {
    fallback.textContent = "3D library unavailable. Refresh the page.";
    return;
  }

  try {
    const canvas = $("avatarCanvas");

    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color("#0c1020");

    threeCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    threeCamera.position.set(0, 1.25, 5.5);
    threeCamera.lookAt(0, 1.1, 0);

    threeRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    threeScene.add(new THREE.HemisphereLight(0xe3eaff, 0x24133f, 2));

    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.position.set(3, 5, 4);
    threeScene.add(light);

    const rim = new THREE.PointLight(0x22d3ee, 18, 10);
    rim.position.set(-2, 2, -2);
    threeScene.add(rim);

    avatarGroup = new THREE.Group();
    threeScene.add(avatarGroup);

    const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.65 });
    const skin = mat("#d89b7c");
    const hair = mat("#20182f");
    const shirt = mat("#6550c9");
    const sleeve = mat("#8b5cf6");
    const pants = mat("#25324f");
    const dark = mat("#171426");

    createPart(avatarGroup, new THREE.CapsuleGeometry(0.42, 0.58, 5, 12),
      shirt, [0, 1.12, 0], [1, 1, 0.75]);

    createPart(avatarGroup, new THREE.CylinderGeometry(0.12, 0.13, 0.22, 16),
      skin, [0, 1.67, 0]);

    createPart(avatarGroup, new THREE.SphereGeometry(0.37, 24, 20),
      skin, [0, 2.02, 0]);

    createPart(avatarGroup, new THREE.SphereGeometry(0.375, 24, 18),
      hair, [0, 2.22, -0.035], [1.02, 0.65, 0.98]);

    createPart(avatarGroup, new THREE.SphereGeometry(0.045, 12, 10),
      dark, [-0.125, 2.04, 0.327]);
    createPart(avatarGroup, new THREE.SphereGeometry(0.045, 12, 10),
      dark, [0.125, 2.04, 0.327]);

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.42, 1.42, 0);
    avatarGroup.add(leftArm);

    createPart(leftArm, new THREE.CapsuleGeometry(0.105, 0.36, 4, 10),
      sleeve, [0, -0.24, 0]);
    createPart(leftArm, new THREE.SphereGeometry(0.11, 14, 12),
      skin, [0, -0.52, 0.03]);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.42, 1.42, 0);
    avatarGroup.add(rightArm);

    createPart(rightArm, new THREE.CapsuleGeometry(0.105, 0.36, 4, 10),
      sleeve, [0, -0.24, 0]);
    createPart(rightArm, new THREE.SphereGeometry(0.11, 14, 12),
      skin, [0, -0.52, 0.03]);

    createPart(avatarGroup, new THREE.CapsuleGeometry(0.16, 0.5, 4, 10),
      pants, [-0.19, 0.35, 0]);
    createPart(avatarGroup, new THREE.CapsuleGeometry(0.16, 0.5, 4, 10),
      pants, [0.19, 0.35, 0]);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.012, 8, 80),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.04;
    ring.scale.set(1.15, 1, 1);
    avatarGroup.add(ring);

    fallback.classList.add("hidden");

    function resize() {
      const width = canvas.clientWidth || 500;
      const height = canvas.clientHeight || 350;
      threeRenderer.setSize(width, height, false);
      threeCamera.aspect = width / height;
      threeCamera.updateProjectionMatrix();
    }

    resize();

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe($("avatarStage"));
    } else {
      window.addEventListener("resize", resize);
    }

    function animate() {
      requestAnimationFrame(animate);
      if (!avatarGroup) return;

      const t = performance.now() / 1000;
      avatarGroup.position.y = Math.sin(t * 1.2) * 0.025;
      avatarGroup.rotation.y = Math.sin(t * 0.4) * 0.1;

      threeRenderer.render(threeScene, threeCamera);
    }

    animate();
  } catch (error) {
    console.error("Avatar startup failed:", error);
    fallback.classList.remove("hidden");
    fallback.textContent = "The avatar could not load. Refresh and try again.";
  }
}

createAvatar();
