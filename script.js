// ==========================
// TEXT INPUT LOGIC
// ==========================
const input = document.getElementById("inputText");
const charCount = document.getElementById("charCount");

input.addEventListener("input", () => {
  charCount.textContent = input.value.length + "/500";
});

// ==========================
// NLP (REALISTIC SIMULATION)
// ==========================
function processText(text) {
  return text
    .replace(/[^\w\s]/g, "")
    .toUpperCase()
    .split(" ")
    .filter(w => w.length > 0)
    .map(w => simplify(w))
    .join(" ");
}

function simplify(word) {
  const remove = ["IS","ARE","AM","THE","A","AN"];
  return remove.includes(word) ? "" : word;
}

// ==========================
// TRANSLATE BUTTON
// ==========================
function translateText() {
  if (!input.value.trim()) {
    alert("Enter text first!");
    return;
  }

  const result = processText(input.value);

  document.getElementById("outputText").innerText = result;

  triggerAvatarSign();
}

// ==========================
// SPEECH TO TEXT
// ==========================
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

function startSpeech() {
  recognition.start();
}

recognition.onresult = (e) => {
  input.value = e.results[0][0].transcript;
};

// ==========================
// THREE.JS AVATAR
// ==========================
let scene, camera, renderer, avatar, mixer;
let clock = new THREE.Clock();

function initAvatar() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 1.5, 3);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(
    document.getElementById("avatarContainer").clientWidth,
    350
  );

  document.getElementById("avatarContainer").appendChild(renderer.domElement);

  // LIGHT
  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
  scene.add(light);

  // LOAD AVATAR
  const loader = new THREE.GLTFLoader();
  loader.load("avatar.glb", (gltf) => {
    avatar = gltf.scene;
    avatar.scale.set(1.5,1.5,1.5);
    scene.add(avatar);

    if (gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(avatar);
      mixer.clipAction(gltf.animations[0]).play();
    }
  });

  animate();
}

function animate() {
  requestAnimationFrame(animate);

  if (mixer) mixer.update(clock.getDelta());

  if (avatar) {
    avatar.rotation.y += 0.003;
  }

  renderer.render(scene, camera);
}

initAvatar();

// ==========================
// FAKE SIGN ANIMATION
// ==========================
function triggerAvatarSign() {
  if (!avatar) return;

  let t = 0;

  function animateSign() {
    t += 0.05;

    avatar.rotation.y += 0.05;
    avatar.position.y = Math.sin(t) * 0.05;

    if (t < 3) requestAnimationFrame(animateSign);
  }

  animateSign();
                                          }
