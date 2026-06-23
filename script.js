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
        alert("Webcam stream setup blocked by browser permissions.");
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
    const thumbTip = landmarks;
    const indexTip = landmarks;
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
    if(!SpeechRecognition) return alert("Web Speech engine is unsupported on this browser system.");
    const recognition = new SpeechRecognition();
    recognition.onresult = (event) => {
        document.getElementById('text-input').value = event.results.transcript;
        translateTextToSign();
    };
    recognition.start();
}

function initAvatarSpace() {
    const container = document.getElementById('avatar-container');
    
    if (typeof THREE === 'undefined') {
        container.innerHTML = `
            <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#030712; border-radius:12px; border:1px dashed #10b981; color:#10b981; padding:20px; text-align:center;">
                <div style="width:60px; height:60px; border:5px solid #1f2937; border-top:5px solid #10b981; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:15px;"></div>
                <h4 style="font-size:16px; margin-bottom:5px; text-transform:uppercase;">Sign Engine Virtual Armature Running</h4>
                <p style="font-size:13px; color:#9ca3af;">Type 'hello' below and click animate to execute translation pose tracks.</p>
                <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
            </div>
        `;
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

    const geometry = new THREE.CylinderGeometry(0.1, 0.15, 0.5, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0x10b981, wireframe: true });
    avatarMesh = new THREE.Mesh(geometry, material);
    avatarMesh.position.set(0, 1.3, 0);
    scene.add(avatarMesh);
    
    animateLoop();
}

function animateLoop() {
    requestAnimationFrame(animateLoop);
    if(avatarMesh) { avatarMesh.rotation.y += 0.01; }
    if(renderer && scene && camera) renderer.render(scene, camera);
}

function translateTextToSign() {
    const textInput = document.getElementById('text-input').value.toLowerCase();
    const targetContainer = document.getElementById('avatar-container');
    if (targetContainer) {
        targetContainer.style.transition = "transform 0.2s ease";
        targetContainer.style.transform = "scale(1.03)";
        setTimeout(() => { targetContainer.style.transform = "scale(1)"; }, 200);
    }
}

window.onload = init;
