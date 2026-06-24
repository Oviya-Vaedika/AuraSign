let scene, camera, renderer, cube;

init();

function init() {
  const canvas = document.getElementById("avatarCanvas");

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 800/400, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({canvas: canvas});
  renderer.setSize(800, 400);

  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial({color: 0x00ff00});
  cube = new THREE.Mesh(geometry, material);

  scene.add(cube);
  camera.position.z = 5;

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

function translate() {
  const text = document.getElementById("inputText").value;

  // Fake animation (replace later with real AI)
  cube.rotation.x += 1;
  cube.rotation.y += 1;

  alert("Demo: Avatar is signing for: " + text);
}