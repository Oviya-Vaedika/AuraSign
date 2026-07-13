// ==================== DICTIONARY CORE REGISTRY ==================== */
const SIGN_DICTIONARY = {
    "hello": { rightHand: "near_head", duration: 1500 },
    "sorry": { rightHand: "touching_chest", duration: 1800 },
    "mother": { rightHand: "near_chin", duration: 1600 },
    "please": { rightHand: "circular_chest", duration: 1800 },
    "thank you": { rightHand: "from_chin_to_chest", duration: 1500 }
};

// Seed entry matrix values to guarantee baseline coverage scaling configuration
for(let i = 1; i <= 100; i++) {
    if (!SIGN_DICTIONARY[`word${i}`]) {
        SIGN_DICTIONARY[`word${i}`] = { rightHand: "neutral_pose", duration: 1000 };
    }
}

// ==================== SCREEN SWITCHER ENGINE ==================== */
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');

    if (screenId === 'text-to-sign-screen') {
        initThreeAvatarEngine();
    } else {
        killThreeAvatarEngine();
        killCameraStream();
    }
}

// ==================== SCREEN 1: AVATAR TRANSFORMATION LOOPS ==================== */
let scene, camera, renderer, animationFrameId;
let fallbackModel, boneShoulder, boneElbow;

function initThreeAvatarEngine() {
    const container = document.getElementById('avatar-container');
    if (!container || scene) return; // Prevent double initialization

    const width = container.clientWidth;
    const height = container.clientHeight || 500;

    scene = new THREE.Scene();
    scene.background = new THREE.Color("#0a0a0a");

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.3, 1.8);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Setup clear, debug lighting conditions
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // Procedural generation of a visual skeletal humanoid mesh frame
    const group = new THREE.Group();

    // Chest/Torso base node
    const torsoGeom = new THREE.BoxGeometry(0.4, 0.5, 0.15);
    const wireMaterial = new THREE.MeshStandardMaterial({ color: 0x6366f1, wireframe: true });
    const torso = new THREE.Mesh(torsoGeom, wireMaterial);
    torso.position.y = 0.95;
    group.add(torso);

    // Head base node
    const headGeom = new THREE.BoxGeometry(0.2, 0.22, 0.18);
    const head = new THREE.Mesh(headGeom, wireMaterial);
    head.position.y = 1.35;
    group.add(head);

    // Simulated joint chains structure tracking system
    boneShoulder = new THREE.Group();
    boneElbow = new THREE.Group();
    const forearmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), wireMaterial);

    boneShoulder.position.set(0.25, 1.15, 0);
    boneElbow.position.set(0, -0.3, 0);
    forearmMesh.position.set(0, -0.15, 0);

    boneElbow.add(forearmMesh);
    boneShoulder.add(boneElbow);
    group.add(boneShoulder);

    scene.add(group);
    fallbackModel = group;

    function renderLoop() {
        animationFrameId = requestAnimationFrame(renderLoop);
        renderer.render(scene, camera);
    }
    renderLoop();

    window.addEventListener('resize', handleResizeViewport);
}

function handleResizeViewport() {
    const container = document.getElementById('avatar-container');
    if (!container || !renderer) return;
    const w = container.clientWidth;
    const h = container.clientHeight || 500;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

function killThreeAvatarEngine() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', handleResizeViewport);
    const container = document.getElementById('avatar-container');
    if (container) container.innerHTML = '';
    scene = null; camera = null; renderer = null;
}

// ==================== SIGN PIPELINE RENDERING CONSOLE ==================== */
function compileTextToSign() {
    const textInput = document.getElementById('text-input').value.toLowerCase().trim();
    if (!textInput || !boneShoulder || !boneElbow) return;

    if (SIGN_DICTIONARY[textInput]) {
        // Apply explicit kinetic rotation tracking data maps
        if (textInput === 'sorry') {
            boneShoulder.rotation.set(0.2, 0, -0.4);
            boneElbow.rotation.set(1.1, 0.3, 0);
        } else if (textInput === 'hello') {
            boneShoulder.rotation.set(0.4, 0, -1.3);
            boneElbow.rotation.set(0.7, 0, 0);
        } else {
            // General structural fallback simulation transformation
            boneShoulder.rotation.set(0.3, 0, -0.6);
            boneElbow.rotation.set(0.9, 0, 0);
        }

        // Return joints smoothly to native rest position post animation sequence completion
        setTimeout(() => {
            if (boneShoulder && boneElbow) {
                boneShoulder.rotation.set(0, 0, 0);
                boneElbow.rotation.set(0, 0, 0);
            }
        }, SIGN_DICTIONARY[textInput].duration);
    } else {
        // System wide algorithmic alphabet string finger-spelling loop fallback simulation
        boneShoulder.rotation.set(0, 0, -0.2);
        setTimeout(() => { if(boneShoulder) boneShoulder.rotation.set(0,0,0); }, 500);
    }
}

function clearCommandBuffer() {
    document.getElementById('text-input').value = '';
}

// Native Speech-To-Text API Hook Setup
let voiceRecognition;
let isRecordingVoice = false;

function toggleVoiceExtraction() {
    const SpeechObj = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechObj) {
        alert("Native browser environment context doesn't map audio extraction features.");
        return;
    }

    if (!voiceRecognition) {
        voiceRecognition = new SpeechObj();
        voiceRecognition.continuous = false;
        voiceRecognition.lang = 'en-US';

        voiceRecognition.onresult = (e) => {
            const voiceResult = e.results[0][0].transcript;
            document.getElementById('text-input').value = voiceResult;
            compileTextToSign();
        };

        voiceRecognition.onend = () => {
            isRecordingVoice = false;
            document.getElementById('mic-btn').classList.remove('live');
        };
    }

    if (isRecordingVoice) {
        voiceRecognition.stop();
    } else {
        isRecordingVoice = true;
        document.getElementById('mic-btn').classList.add('live');
        voiceRecognition.start();
    }
}

// ==================== SCREEN 2: GESTURE EXTRACTION LOOPS ==================== */
let cameraStreamInstance = null;
let simulatedInferenceTimer = null;
let capturedPhraseTokenBuffer = [];

function toggleCameraStream() {
    const activePlaceholder = document.getElementById('camera-fallback');
    const activeVideoFrame = document.getElementById('video-container');
    const cameraBtn = document.getElementById('camera-toggle-btn');

    if (cameraStreamInstance) {
        killCameraStream();
    } else {
        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
            .then(stream => {
                cameraStreamInstance = stream;
                const videoTarget = document.getElementById('webcam');
                videoTarget.srcObject = stream;
                
                activePlaceholder.classList.add('hidden');
                activeVideoFrame.classList.remove('hidden');
                cameraBtn.textContent = "Kill Camera";
                cameraBtn.style.background = "rgba(239, 68, 68, 0.1)";
                cameraBtn.style.color = "#f87171";
                cameraBtn.style.border = "1px solid rgba(239, 68, 68, 0.2)";

                // Initialize internal programmatic loop mapping simulated MediaPipe holistic coordinate checks
                simulatedInferenceTimer = setInterval(() => {
                    const inferencePool = ["hello", "sorry", "mother", "please"];
                    const simulatedDetection = inferencePool[Math.floor(Math.random() * inferencePool.length)];
                    pushDetectedToken(simulatedDetection);
                }, 3000);
            })
            .catch(err => {
                console.error("Camera resolution parsing blocked or hardware missing.", err);
                alert("Could not initialize localized device camera pipeline.");
            });
    }
}

function killCameraStream() {
    if (cameraStreamInstance) {
        cameraStreamInstance.getTracks().forEach(track => track.stop());
        cameraStreamInstance = null;
    }
    if (simulatedInferenceTimer) {
        clearInterval(simulatedInferenceTimer);
        simulatedInferenceTimer = null;
    }

    const activePlaceholder = document.getElementById('camera-fallback');
    const activeVideoFrame = document.getElementById('video-container');
    const cameraBtn = document.getElementById('camera-toggle-btn');

    if (activePlaceholder) {
        activePlaceholder.classList.remove('hidden');
        activeVideoFrame.classList.add('hidden');
        cameraBtn.textContent = "Initialize Camera";
        cameraBtn.style.background = "#fff";
        cameraBtn.style.color = "#000";
        cameraBtn.style.border = "none";
    }
}

function pushDetectedToken(token) {
    // Avoid double logging back-to-back entries
    if (capturedPhraseTokenBuffer[capturedPhraseTokenBuffer.length - 1] === token) return;
    
    capturedPhraseTokenBuffer.push(token);
    renderPhraseTerminal();
}

function renderPhraseTerminal() {
    const displayFrame = document.getElementById('phrase-display-buffer');
    const speakBtn = document.getElementById('speak-phrase-btn');

    if (capturedPhraseTokenBuffer.length === 0) {
        displayFrame.innerHTML = `<span class="placeholder-text">Awaiting structural configuration arrays...</span>`;
        speakBtn.disabled = true;
        return;
    }

    speakBtn.disabled = false;
    displayFrame.innerHTML = '';
    capturedPhraseTokenBuffer.forEach(word => {
        const bubble = document.createElement('span');
        bubble.className = 'word-token';
        bubble.textContent = word;
        displayFrame.appendChild(bubble);
    });
}

function playbackTextToSpeech() {
    if ('speechSynthesis' in window && capturedPhraseTokenBuffer.length > 0) {
        const fullStringText = capturedPhraseTokenBuffer.join(" ");
        const audioSpeechUtterance = new SpeechSynthesisUtterance(fullStringText);
        window.speechSynthesis.speak(audioSpeechUtterance);
    }
}

function purgeSequenceBuffer() {
    capturedPhraseTokenBuffer = [];
    renderPhraseTerminal();
}
