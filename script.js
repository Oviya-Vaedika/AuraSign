// 🎥 Camera
function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      document.getElementById("video").srcObject = stream;
    });
}

// 🎤 Text to Speech
function speakText() {
  let text = document.getElementById("textInput").value;
  let speech = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(speech);

  document.getElementById("status").innerText = "Speaking + Avatar animating...";
}

// 🎮 THREE.JS AVATAR
let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
let renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("avatarCanvas"), alpha: true });

renderer.setSize(400, 400);

let light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 1, 1);
scene.add(light);

let loader = new THREE.GLTFLoader();

loader.load('avatar.glb', function(gltf) {
  let model = gltf.scene;
  scene.add(model);
  model.scale.set(2,2,2);

  function animate() {
    requestAnimationFrame(animate);
    model.rotation.y += 0.01; // slow rotation
    renderer.render(scene, camera);
  }

  animate();
});

camera.position.z = 3;