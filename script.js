// CAMERA
let video = document.getElementById("video");

function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      startTracking();
    });
}

// HAND TRACKING
let lastSpoken = "";

function startTracking() {

  const hands = new Hands({
    locateFile: file =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 1,
    minDetectionConfidence: 0.8
  });

  hands.onResults(results => {
    if (results.multiHandLandmarks.length > 0) {

      let gesture = detect(results.multiHandLandmarks[0]);

      document.getElementById("output").innerText =
        "Detected: " + gesture;

      speak(gesture);

    } else {
      document.getElementById("output").innerText = "No hand";
    }
  });

  const cam = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    }
  });

  cam.start();
}

// GESTURE LOGIC
function detect(lm) {

  let index = lm[8];
  let middle = lm[12];

  // Fist → A
  if (index.y > lm[6].y && middle.y > lm[10].y)
    return "A";

  // Open → B
  if (index.y < lm[6].y && middle.y < lm[10].y)
    return "B";

  // Point → Hello
  if (index.y < lm[6].y && middle.y > lm[10].y)
    return "Hello";

  return "Unknown";
}

// SPEAK
function speak(text) {
  if (text !== lastSpoken && text !== "Unknown") {
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    lastSpoken = text;
  }
}

// TEXT → SIGN (API READY)
function convert() {
  let text = document.getElementById("input").value;

  document.getElementById("status").innerText = "Processing...";

  fetch("https://api.deepmotion.com/v1/animate", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  })
  .then(res => res.json())
  .then(data => {
    console.log(data);
    document.getElementById("status").innerText =
      "Animation triggered";
  })
  .catch(() => {
    document.getElementById("status").innerText =
      "API error (check key)";
  });
}

// 3D AVATAR
let scene = new THREE.Scene();

let camera3D = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
camera3D.position.set(0, 1.2, 2);

let renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("canvas"),
  alpha: true
});

renderer.setSize(600, 500);

let light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(2,2,2);
scene.add(light);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));

let loader = new THREE.GLTFLoader();

loader.load("avatar.glb", function(gltf) {

  let model = gltf.scene;

  model.scale.set(1.5,1.5,1.5);
  model.position.set(0,-1,0);

  scene.add(model);

  function animate() {
    requestAnimationFrame(animate);
    model.rotation.y += 0.002;
    renderer.render(scene, camera3D);
  }

  animate();
});
