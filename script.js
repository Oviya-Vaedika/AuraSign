let scene, camera, renderer, model;

function startApp() {
  document.getElementById("home").style.display = "none";
  document.getElementById("app").style.display = "flex";
  init3D();
}

function init3D() {
  const canvas = document.getElementById("avatarCanvas");

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ canvas });

  renderer.setSize(canvas.clientWidth, canvas.clientHeight);

  const light = new THREE.HemisphereLight(0xffffff, 0x444444);
  scene.add(light);

  const loader = new THREE.GLTFLoader();

  // FREE HUMAN MODEL (READY)
  loader.load(
    "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
    function (gltf) {
      model = gltf.scene;
      scene.add(model);
      model.position.set(0, -1, -3);
    }
  );

  camera.position.z = 2;

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
}

function translate() {
  const text = document.getElementById("textInput").value.toLowerCase();
  const status = document.getElementById("status");

  if (!model) {
    status.innerText = "Avatar loading...";
    return;
  }

  if (text === "hello") {
    model.rotation.y += 0.5; // simple animation
    status.innerText = "Showing Hello gesture";
  }
  else if (text === "please") {
    model.rotation.x += 0.5;
    status.innerText = "Showing Please gesture";
  }
  else if (text === "thank you") {
    model.rotation.z += 0.5;
    status.innerText = "Showing Thank You gesture";
  }
  else {
    status.innerText = "Gesture not available";
  }
}

function speak() {
  const text = document.getElementById("textInput").value;
  const speech = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(speech);
}