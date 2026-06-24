let scene, camera, renderer, mixer, clock;

// 🔥 OPEN APP
function openApp() {
  document.getElementById("intro").style.display = "none";
  document.getElementById("app").classList.remove("hidden");
  init3D();
}

// 🎤 SPEECH TO TEXT
function startSpeech() {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.start();

  recognition.onresult = function(event) {
    document.getElementById("textInput").value =
      event.results[0][0].transcript;
  };
}

// 📷 CAMERA ACCESS
function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      document.getElementById("camera").srcObject = stream;
    })
    .catch(() => {
      alert("Camera permission denied");
    });
}

// 🤖 TRANSLATE TEXT → ANIMATION
function translateText() {
  if (mixer) {
    alert("Avatar is signing...");
  }
}

// 🎬 THREE.JS AVATAR
function init3D() {
  const canvas = document.getElementById("avatarCanvas");

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(75, 800/400, 0.1, 1000);
  camera.position.set(0, 1.5, 3);

  renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
  renderer.setSize(800, 400);

  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(light);

  clock = new THREE.Clock();

  const loader = new THREE.GLTFLoader();

  loader.load('avatar.glb', function (gltf) {
    const model = gltf.scene;

    model.scale.set(1.2, 1.2, 1.2);
    model.position.set(0, -1, 0);

    scene.add(model);

    mixer = new THREE.AnimationMixer(model);

    if (gltf.animations.length > 0) {
      const action = mixer.clipAction(gltf.animations[0]);
      action.play();
    }
  });

  animate();
}

function animate() {
  requestAnimationFrame(animate);

  if (mixer) {
    const delta = clock.getDelta();
    mixer.update(delta);
  }

  renderer.render(scene, camera);
}