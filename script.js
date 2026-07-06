// ELEMENTS
let video = document.getElementById("video");
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

canvas.width = 640;
canvas.height = 500;

let lastSpoken = "";
let history = [];

// START CAMERA
function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      startTracking();
    });
}

// HOLISTIC TRACKING
function startTracking() {

  const holistic = new Holistic({
    locateFile: file =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
  });

  holistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
  });

  holistic.onResults(results => {

    ctx.clearRect(0,0,canvas.width,canvas.height);

    if (!results.rightHandLandmarks) {
      setOutput("No hand");
      return;
    }

    let hand = results.rightHandLandmarks;
    let pose = results.poseLandmarks;

    drawHand(hand);

    let letter = detectLetter(hand);
    let word = detectWord(hand, pose);

    let final = word || letter || "Unknown";

    setOutput(final);
    speak(final);

    trackMotion(hand);
  });

  const cam = new Camera(video, {
    onFrame: async () => {
      await holistic.send({ image: video });
    },
    width: 640,
    height: 480
  });

  cam.start();
}

// DRAW HAND
function drawHand(lm) {

  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 3;

  function line(a,b){
    ctx.beginPath();
    ctx.moveTo(a.x*640, a.y*500);
    ctx.lineTo(b.x*640, b.y*500);
    ctx.stroke();
  }

  let fingers = [
    [0,1,2,3,4],
    [0,5,6,7,8],
    [0,9,10,11,12],
    [0,13,14,15,16],
    [0,17,18,19,20]
  ];

  fingers.forEach(f => {
    for(let i=0;i<f.length-1;i++){
      line(lm[f[i]], lm[f[i+1]]);
    }
  });
}

// HELPER
function isUp(tip, pip){
  return tip.y < pip.y;
}

// 🔥 IMPROVED A–Z DETECTION
function detectLetter(lm){

  let t = isUp(lm[4],lm[3]);
  let i = isUp(lm[8],lm[6]);
  let m = isUp(lm[12],lm[10]);
  let r = isUp(lm[16],lm[14]);
  let p = isUp(lm[20],lm[18]);

  let key = `${t}-${i}-${m}-${r}-${p}`;

  switch(key){

    case "false-false-false-false-false": return "A";
    case "false-true-true-true-true": return "B";
    case "true-true-false-false-false": return "L";
    case "false-true-false-false-false": return "D";
    case "true-false-false-false-true": return "Y";
    case "false-true-true-false-false": return "U";
    case "false-true-true-true-false": return "W";

    default: return "";
  }
}

// 🔥 WORD SYSTEM (EXPANDABLE TO 100+)
function detectWord(hand, pose){

  if (!pose) return "";

  let chestY = (pose[11].y + pose[12].y) / 2;
  let shoulderY = pose[11].y;
  let handY = hand[0].y;

  // HELLO
  if (handY < shoulderY - 0.1) {
    return "Hello";
  }

  // PLEASE / SORRY (chest motion)
  if (Math.abs(handY - chestY) < 0.08) {

    if (isCircularMotion()) {
      return "Sorry";
    } else {
      return "Please";
    }
  }

  // YES (up-down motion)
  if (isVerticalMotion()) {
    return "Yes";
  }

  // NO (side motion)
  if (isHorizontalMotion()) {
    return "No";
  }

  return "";
}

// 🔥 MOTION TRACKING (VERY IMPORTANT)
function trackMotion(hand){

  history.push({
    x: hand[0].x,
    y: hand[0].y
  });

  if (history.length > 10) {
    history.shift();
  }
}

// MOTION DETECTORS
function isVerticalMotion(){
  let ys = history.map(p => p.y);
  return Math.max(...ys) - Math.min(...ys) > 0.1;
}

function isHorizontalMotion(){
  let xs = history.map(p => p.x);
  return Math.max(...xs) - Math.min(...xs) > 0.1;
}

function isCircularMotion(){
  let xs = history.map(p => p.x);
  let ys = history.map(p => p.y);

  let dx = Math.max(...xs) - Math.min(...xs);
  let dy = Math.max(...ys) - Math.min(...ys);

  return dx > 0.05 && dy > 0.05;
}

// OUTPUT
function setOutput(text){
  document.getElementById("output").innerText =
    "Detected: " + text;
}

// SPEAK
function speak(text){
  if (text !== lastSpoken && text !== "Unknown") {
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    lastSpoken = text;
  }
}