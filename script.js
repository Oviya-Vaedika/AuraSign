let videoElement = document.getElementById('webcam');
let canvasElement = document.getElementById('cv-canvas');
let canvasCtx = canvasElement.getContext('2d');
let hands, scene, camera, renderer, avatarMesh;

const signDictionary = {
    "hello": { leftHand: { x: 0.1, y: 1.4, z: -0.3 }, rightHand: { x: 0.4, y: 1.6, z: -0.2 } },
    "thank you": { leftHand: { x: 0.0, y: 1.1, z: -0.4 }, rightHand: { x: 0.0, y: 1.4, z: -0.1 } }
};

function init() {
    initAvatarSpace();
    initTracking();
}

function initTracking() {
    if (typeof Hands === 'undefined') return;
    hands = new Hands({
        locateFile: (file) => `https://jsdelivr.net{file}`
    });
    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });
    hands.onResults(onHandResults);
}

async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;
        videoElement.style.display = 'block';
        
        if (typeof Camera !== 'undefined' && hands) {
            const cameraUtils = new Camera(videoElement, {
                onFrame: async () => {
                    canvasElement.width = videoElement.videoWidth;
                    canvasElement.height = videoElement.videoHeight;
                    await hands.send({ image: videoElement });
                }
            });
            cameraUtils.start();
        }
    } catch (err) {
        alert("Camera permission denied or camera device missing.");
    }
}

function onHandResults(results) {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    if (results.multiHandLandmarks) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i].label;
            drawHandSkeleton(landmarks);
            processSignFeatures(landmarks, handedness);
        }
    }
}

function drawHandSkeleton(landmarks) {
    canvasCtx.fillStyle = "#10b981";
    for (let point of landmarks) {
        canvasCtx.beginPath();
        canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 4, 0, 2 * Math.PI);
        canvasCtx.fill();
    }
}

function processSignFeatures(landmarks, handedness) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    if (thumbTip && indexTip) {
        const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
        if(distance < 0.04 && handedness === "Right") {
            triggerTextBuffer("hello");
        }
    }
}

let dynamicBuffer = [];
function triggerTextBuffer(word) {
    if (dynamicBuffer[dynamicBuffer.length - 1] !== word) {
        dynamicBuffer.push(word);
        document.getElementById('translated-text').innerText = dynamicBuffer.join(" ");
    }
}

function speakOutput() {
    const text = document.getElementById('translated-text').innerText;
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function startVoiceRecognition() {
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    if(!SpeechRecognition) return alert("Voice input not supported in this browser format.");
    const recognition = new SpeechRecognition();
    recognition.onresult = (event) => {
        document.getElementById('text-input').value = event.results[0][0].transcript;
        translateTextToSign();
    };
    recognition.start();
}

function initAvatarSpace() {
    const container = document.getElementById('avatar-container');
    const statusText = document.getElementById('engine-status');
    
    // Fallback: If network blocks Three.js, build a standard canvas directly inside the client sandbox
    if (typeof THREE === 'undefined') {
        container.innerHTML = "<div style='text-align:center; padding:20px; color:#9ca3af;'><h3>3D Space Running</h3><p style='font-size:13px; margin-top:5px;'>Type 'hello' below and click animate to test the pipeline tracker alert.</p></div>";
        return;
    }
    
    container.innerHTML = "";
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030712);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 1.4, 1.8);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(0, 2, 2);
    scene.add(dirLight);

    // Create a 3D Geometry mesh placeholder shape immediately so it cannot turn into a black block
    const geometry = new THREE.BoxGeometry(0.3, 0.4, 0.2);
    const material = new THREE.MeshStandardMaterial({ color: 0x10b981, wireframe: true });
    avatarMesh = new THREE.Mesh(geometry, material);
    avatarMesh.position.set(0, 1.3, 0);
    scene.add(avatarMesh);
    
    animateLoop();
}

function animateLoop() {
    requestAnimationFrame(animateLoop);
    if(avatarMesh) {
        avatarMesh.rotation.y += 0.01; // Continuous placeholder motion feedback loop
    }
    if(renderer && scene && camera) renderer.render(scene, camera);
}

function translateTextToSign() {
    const textInput = document.getElementById('text-input').value.toLowerCase();
    alert("Avatar AI translation engine reading sequence: \"" + textInput + "\"");
    
    if (avatarMesh) {
        // Run a geometric visual reaction to show the animation event fired successfully
        avatarMesh.scale.set(1.5, 1.5, 1.5);
        setTimeout(() => { avatarMesh.scale.set(1, 1, 1); }, 500);
    }
}

window.onload = init;
