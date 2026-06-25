/**
 * AURA SIGN — script.js
 * Features:
 *  - NLP gloss engine (filler-word removal, ASL grammar)
 *  - Web Speech API speech-to-text
 *  - Three.js 3D avatar viewer (loads avatar.glb if present)
 *  - State machine: idle → processing → output
 *  - Smooth transitions, copy gloss, mobile menu
 */

/* ═══════════════════════════════════════
   1.  DOM REFERENCES
═══════════════════════════════════════ */
const textInput     = document.getElementById('text-input');
const charCount     = document.getElementById('char-count');
const translateBtn  = document.getElementById('translate-btn');
const clearBtn      = document.getElementById('clear-btn');
const micBtn        = document.getElementById('mic-btn');
const micLabel      = document.getElementById('mic-label');
const micIcon       = document.getElementById('mic-icon');
const errorMsg      = document.getElementById('error-msg');
const glossOutput   = document.getElementById('gloss-output');
const copyBtn       = document.getElementById('copy-btn');
const hamburger     = document.getElementById('hamburger');
const mobileMenu    = document.getElementById('mobile-menu');
const outputDot     = document.getElementById('output-status-dot');
const exampleChips  = document.querySelectorAll('.example-chip');

// Avatar overlay state panels
const stateIdle       = document.getElementById('state-idle');
const stateProcessing = document.getElementById('state-processing');
const stateOutput     = document.getElementById('state-output');

/* ═══════════════════════════════════════
   2.  CHARACTER COUNTER
═══════════════════════════════════════ */
textInput.addEventListener('input', () => {
  charCount.textContent = textInput.value.length;
  if (errorMsg && textInput.value.length > 0) hideError();
});

/* ═══════════════════════════════════════
   3.  ERROR HELPERS
═══════════════════════════════════════ */
function showError() {
  errorMsg.classList.remove('hidden');
}
function hideError() {
  errorMsg.classList.add('hidden');
}

/* ═══════════════════════════════════════
   4.  MOBILE MENU TOGGLE
═══════════════════════════════════════ */
hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('hidden');
});

/* ═══════════════════════════════════════
   5.  EXAMPLE CHIPS
═══════════════════════════════════════ */
exampleChips.forEach(chip => {
  chip.addEventListener('click', () => {
    textInput.value = chip.dataset.text;
    charCount.textContent = chip.dataset.text.length;
    hideError();
    textInput.focus();
  });
});

/* ═══════════════════════════════════════
   6.  CLEAR BUTTON
═══════════════════════════════════════ */
clearBtn.addEventListener('click', () => {
  textInput.value = '';
  charCount.textContent = 0;
  hideError();
  setAvatarState('idle');
  glossOutput.textContent = '—';
  outputDot.className = 'status-dot';
  textInput.focus();
});

/* ═══════════════════════════════════════
   7.  NLP GLOSS ENGINE
   Converts plain English → ASL-style gloss:
    - Strip punctuation
    - Uppercase all tokens
    - Remove filler/function words
    - Return joined gloss string
═══════════════════════════════════════ */
const FILLER_WORDS = new Set([
  'IS', 'ARE', 'WAS', 'WERE', 'BE', 'BEEN', 'BEING',
  'AM', 'THE', 'A', 'AN',
  'TO', 'OF', 'IN', 'ON', 'AT', 'BY', 'FOR',
  'WITH', 'FROM', 'ABOUT', 'INTO',
  'THAT', 'THIS', 'THESE', 'THOSE',
  'IT', 'ITS',
  'AND', 'OR', 'BUT', 'SO', 'YET', 'NOR',
  'DO', 'DOES', 'DID', 'WILL', 'WOULD', 'COULD',
  'SHOULD', 'MUST', 'SHALL', 'MAY', 'MIGHT',
  'HAVE', 'HAS', 'HAD',
  'JUST', 'VERY', 'QUITE', 'REALLY', 'ALREADY',
  'SOME', 'ANY', 'ALL', 'EACH', 'EVERY',
]);

function toASLGloss(sentence) {
  // Remove punctuation (keep alphanumeric + apostrophe for contractions)
  const clean = sentence.replace(/[^a-zA-Z0-9'\s]/g, '').trim();

  // Split into tokens, uppercase
  const tokens = clean.split(/\s+/).map(t => t.toUpperCase());

  // Remove filler words, keep content words
  const glossTokens = tokens.filter(t => t.length > 0 && !FILLER_WORDS.has(t));

  // If nothing left, return original uppercased (fallback)
  if (glossTokens.length === 0) {
    return tokens.filter(t => t.length > 0).join(' ');
  }

  return glossTokens.join(' ');
}

/* ═══════════════════════════════════════
   8.  AVATAR STATE MACHINE
═══════════════════════════════════════ */
function setAvatarState(state) {
  // Hide all overlays first
  stateIdle.classList.add('hidden');
  stateProcessing.classList.add('hidden');
  stateOutput.classList.add('hidden');

  if (state === 'idle') {
    stateIdle.classList.remove('hidden');
    outputDot.className = 'status-dot';
    triggerAvatarMotion('idle');
  } else if (state === 'processing') {
    stateProcessing.classList.remove('hidden');
    outputDot.className = 'status-dot processing';
    triggerAvatarMotion('processing');
  } else if (state === 'output') {
    stateOutput.classList.remove('hidden');
    outputDot.className = 'status-dot done';
    triggerAvatarMotion('output');
  }
}

// Initial state
setAvatarState('idle');

/* ═══════════════════════════════════════
   9.  TRANSLATE HANDLER
═══════════════════════════════════════ */
translateBtn.addEventListener('click', runTranslation);
textInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runTranslation();
});

function runTranslation() {
  const raw = textInput.value.trim();

  if (!raw) {
    showError();
    textInput.focus();
    return;
  }

  hideError();
  setAvatarState('processing');
  glossOutput.textContent = '…';

  // Simulate async NLP processing (makes the animation visible)
  setTimeout(() => {
    const gloss = toASLGloss(raw);
    glossOutput.textContent = gloss;
    setAvatarState('output');

    // After 3 s return to idle
    setTimeout(() => {
      setAvatarState('idle');
    }, 3500);
  }, 1400);
}

/* ═══════════════════════════════════════
   10.  COPY GLOSS
═══════════════════════════════════════ */
copyBtn.addEventListener('click', () => {
  const text = glossOutput.textContent;
  if (!text || text === '—' || text === '…') return;

  navigator.clipboard.writeText(text).then(() => {
    copyBtn.style.borderColor = '#22c55e';
    copyBtn.style.color = '#22c55e';
    setTimeout(() => {
      copyBtn.style.borderColor = '';
      copyBtn.style.color = '';
    }, 1200);
  }).catch(() => {
    // Fallback for browsers without clipboard API
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
});

/* ═══════════════════════════════════════
   11.  SPEECH-TO-TEXT (Web Speech API)
═══════════════════════════════════════ */
let recognition = null;
let isListening = false;

// Check browser support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  micBtn.title = 'Speech recognition not supported in this browser';
  micBtn.style.opacity = '0.45';
  micBtn.style.cursor = 'not-allowed';
  micLabel.textContent = 'No mic';
} else {
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.addEventListener('start', () => {
    isListening = true;
    micBtn.classList.add('listening');
    micLabel.textContent = 'Listening…';
    // Change mic icon to stop icon while listening
    micIcon.innerHTML = `
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>
    `;
  });

  recognition.addEventListener('result', (e) => {
    let transcript = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      transcript += e.results[i][0].transcript;
    }
    textInput.value = transcript;
    charCount.textContent = transcript.length;
    hideError();
  });

  recognition.addEventListener('end', () => {
    isListening = false;
    micBtn.classList.remove('listening');
    micLabel.textContent = 'Speak';
    // Restore mic icon
    micIcon.innerHTML = `
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M5 10a7 7 0 0014 0M12 19v3M9 22h6"/>
    `;
  });

  recognition.addEventListener('error', (e) => {
    console.warn('Speech recognition error:', e.error);
    isListening = false;
    micBtn.classList.remove('listening');
    micLabel.textContent = 'Speak';
    micIcon.innerHTML = `
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M5 10a7 7 0 0014 0M12 19v3M9 22h6"/>
    `;
  });

  micBtn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (err) {
        console.warn('Could not start recognition:', err);
      }
    }
  });
}

/* ═══════════════════════════════════════
   12.  THREE.JS AVATAR VIEWER
═══════════════════════════════════════ */
(function initThree() {
  const canvas = document.getElementById('avatar-canvas');
  const wrapper = document.getElementById('avatar-wrapper');

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);  // transparent background
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Scene
  const scene = new THREE.Scene();

  // Camera
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1.2, 3.2);
  camera.lookAt(0, 0.8, 0);

  // Lighting rig
  const ambientLight = new THREE.AmbientLight(0x8b5cf6, 0.5);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xa78bfa, 1.2);
  dirLight.position.set(2, 5, 3);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const pointLight1 = new THREE.PointLight(0x06b6d4, 1.5, 10);
  pointLight1.position.set(-2, 2, 2);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0x6366f1, 1.0, 8);
  pointLight2.position.set(2, 1, -1);
  scene.add(pointLight2);

  // Placeholder avatar geometry (shown when avatar.glb is not loaded)
  const placeholderGroup = new THREE.Group();

  // Body cylinder
  const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 1.0, 32);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x8b5cf6,
    metalness: 0.2,
    roughness: 0.5,
    emissive: 0x3b0764,
    emissiveIntensity: 0.4,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.5;
  placeholderGroup.add(body);

  // Head sphere
  const headGeo = new THREE.SphereGeometry(0.28, 32, 32);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xa78bfa,
    metalness: 0.1,
    roughness: 0.45,
    emissive: 0x4c1d95,
    emissiveIntensity: 0.3,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.28;
  placeholderGroup.add(head);

  // Left arm
  const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 16);
  const armMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    metalness: 0.3,
    roughness: 0.4,
    emissive: 0x0e4b5a,
    emissiveIntensity: 0.4,
  });

  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.45, 0.7, 0);
  leftArm.rotation.z = 0.4;
  placeholderGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, armMat.clone());
  rightArm.position.set(0.45, 0.7, 0);
  rightArm.rotation.z = -0.4;
  placeholderGroup.add(rightArm);

  // Hands
  const handGeo = new THREE.SphereGeometry(0.1, 16, 16);
  const handMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e4b5a, emissiveIntensity: 0.5 });

  const leftHand = new THREE.Mesh(handGeo, handMat);
  leftHand.position.set(-0.72, 0.46, 0);
  placeholderGroup.add(leftHand);

  const rightHand = new THREE.Mesh(handGeo, handMat.clone());
  rightHand.position.set(0.72, 0.46, 0);
  placeholderGroup.add(rightHand);

  // Glowing ring base
  const ringGeo = new THREE.TorusGeometry(0.5, 0.02, 8, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.4 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0;
  ring.rotation.x = Math.PI / 2;
  placeholderGroup.add(ring);

  scene.add(placeholderGroup);

  // GLTFLoader — attempt to load avatar.glb
  let mixer = null;
  let loadedModel = null;
  let avatarAnimations = [];

  if (typeof THREE !== 'undefined' && THREE.GLTFLoader) {
    const loader = new THREE.GLTFLoader();
    loader.load(
      'avatar.glb',
      (gltf) => {
        loadedModel = gltf.scene;
        avatarAnimations = gltf.animations || [];

        // Auto-scale to fit view
        const box = new THREE.Box3().setFromObject(loadedModel);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.8 / maxDim;
        loadedModel.scale.setScalar(scale);

        // Center model
        const center = box.getCenter(new THREE.Vector3());
        loadedModel.position.set(-center.x * scale, -center.y * scale + 0.1, -center.z * scale);

        scene.add(loadedModel);
        scene.remove(placeholderGroup); // hide placeholder

        // Setup animation mixer
        if (avatarAnimations.length > 0) {
          mixer = new THREE.AnimationMixer(loadedModel);
          const idleClip = avatarAnimations.find(a => /idle/i.test(a.name)) || avatarAnimations[0];
          if (idleClip) mixer.clipAction(idleClip).play();
        }
      },
      undefined,
      () => {
        // avatar.glb not found — placeholder already visible, continue gracefully
        console.info('Aura Sign: avatar.glb not found. Showing placeholder avatar.');
      }
    );
  }

  /* ── Avatar animation parameters ── */
  let avatarState = 'idle';
  let animTime = 0;
  let translateAnimT = 0;  // drives translation burst animation
  let isTranslateAnim = false;

  /**
   * Called by the state machine above to trigger 3D motion
   */
  window.triggerAvatarMotion = function(state) {
    avatarState = state;
    if (state === 'output' || state === 'processing') {
      isTranslateAnim = true;
      translateAnimT = 0;

      // If loaded model has animations, play one
      if (mixer && avatarAnimations.length > 0) {
        mixer.stopAllAction();
        const clip = avatarAnimations[Math.floor(Math.random() * avatarAnimations.length)];
        mixer.clipAction(clip).reset().play();
      }
    }
    if (state === 'idle' && mixer && avatarAnimations.length > 0) {
      mixer.stopAllAction();
      const idleClip = avatarAnimations.find(a => /idle/i.test(a.name)) || avatarAnimations[0];
      if (idleClip) mixer.clipAction(idleClip).play();
    }
  };

  // Resize handling
  function resizeRenderer() {
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resizeRenderer);
  resizeObserver.observe(wrapper);
  resizeRenderer();

  // Animation clock
  const clock = new THREE.Clock();

  // Render loop
  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    animTime += delta;

    if (mixer) mixer.update(delta);

    const target = loadedModel || placeholderGroup;

    if (avatarState === 'idle') {
      // Gentle idle rotation + slight bob
      target.rotation.y = Math.sin(animTime * 0.35) * 0.18;
      target.position.y = Math.sin(animTime * 0.7) * 0.018;
    } else if (avatarState === 'processing') {
      // Spin faster + bounce
      target.rotation.y += delta * 1.8;
      target.position.y = Math.sin(animTime * 2.5) * 0.04;
    } else if (avatarState === 'output') {
      if (isTranslateAnim) {
        translateAnimT += delta;
        // Quick dramatic rotation + vertical pop
        target.rotation.y = Math.sin(translateAnimT * 4) * 0.4;
        target.position.y = Math.abs(Math.sin(translateAnimT * 3)) * 0.12;
        if (translateAnimT > 1.6) isTranslateAnim = false;
      } else {
        target.rotation.y = Math.sin(animTime * 0.35) * 0.1;
        target.position.y = 0;
      }
    }

    // Animate ring glow
    if (ring && ring.material) {
      ring.material.opacity = 0.2 + Math.abs(Math.sin(animTime * 1.5)) * 0.4;
      ring.rotation.y += delta * 0.6;
    }

    // Animate point lights for aura feel
    pointLight1.intensity = 1.2 + Math.sin(animTime * 1.1) * 0.5;
    pointLight2.intensity = 0.8 + Math.cos(animTime * 0.9) * 0.4;

    renderer.render(scene, camera);
  }

  animate();
})();
