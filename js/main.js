/**
 * 3D Character Editor – vanilla Three.js
 * Personagem + Animação + Objeto + Osso + Anexação + Tamanho + Brilho
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── State ────────────────────────────────────────────────────
const state = {
  character: null,
  object: null,
  bones: [],
  animations: [],
  mixer: null,
  currentAction: null,
  charBaseScale: 1,
  objBaseScale: 1,
  exposure: 1.0,
  selected: 'character', // 'character' | 'object'
  attachedBone: null,
};

// ─── DOM refs ─────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const viewportEl   = $('viewport');
const loadingEl    = $('loading');
const statusEl     = $('status');
const charInput    = $('char-input');
const objInput     = $('obj-input');
const animSelect   = $('anim-select');
const boneSelect   = $('bone-select');
const btnPlay      = $('btn-play');
const btnStop      = $('btn-stop');
const btnAttach    = $('btn-attach');
const btnDetach    = $('btn-detach');
const btnBrightUp  = $('btn-bright-up');
const btnBrightDown= $('btn-bright-down');
const brightLabel  = $('bright-label');
const sizePct      = $('size-pct');
const posX = $('pos-x'), posY = $('pos-y'), posZ = $('pos-z');
const rotX = $('rot-x'), rotY = $('rot-y'), rotZ = $('rot-z');
const selChar = $('sel-char'), selObj = $('sel-obj');

// ─── Three.js setup ───────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1b2a);
scene.fog = new THREE.Fog(0x0d1b2a, 25, 70);

const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
camera.position.set(0, 1.5, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = state.exposure;
viewportEl.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 1, 0);
controls.minDistance = 0.5;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI / 1.75;

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 1.1);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
dirLight.position.set(3, 8, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 50;
dirLight.shadow.camera.left = -6;
dirLight.shadow.camera.right = 6;
dirLight.shadow.camera.top = 12;
dirLight.shadow.camera.bottom = -2;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x4488ff, 0.45);
fillLight.position.set(-4, 3, -3);
scene.add(fillLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.35);
backLight.position.set(0, 4, -6);
scene.add(backLight);

// Grid + ground
const grid = new THREE.GridHelper(20, 40, 0x1a3a5c, 0x112233);
scene.add(grid);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x0a1520, roughness: 0.9, metalness: 0.1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Clock
const clock = new THREE.Clock();

// ─── Helpers ──────────────────────────────────────────────────
function setStatus(msg) {
  statusEl.textContent = msg;
}

function showLoading(show) {
  loadingEl.classList.toggle('hidden', !show);
}

function resize() {
  const w = viewportEl.clientWidth;
  const h = viewportEl.clientHeight;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();

function focusOn(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  const height = Math.max(size.y, 0.5);
  controls.target.copy(center);
  camera.position.set(center.x, center.y + height * 0.25, height * 2.4);
  controls.update();
}

function collectBones(root) {
  const bones = [];
  root.traverse((c) => {
    if (c.isBone) bones.push(c);
  });
  bones.sort((a, b) => a.name.localeCompare(b.name));
  return bones;
}

function enableShadows(root) {
  root.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
}

function autoScaleAndPlace(object, targetHeight = 2.0) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const s = targetHeight / maxDim;
  object.scale.setScalar(s);

  object.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(object);
  object.position.y = -box2.min.y;

  return s; // base scale
}

function loadModel(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop().toLowerCase();

    const onDone = (object, animations = []) => {
      URL.revokeObjectURL(url);
      resolve({ object, animations });
    };

    if (ext === 'fbx') {
      const loader = new FBXLoader();
      loader.load(url, (fbx) => {
        onDone(fbx, fbx.animations || []);
      }, undefined, reject);
    } else if (ext === 'glb' || ext === 'gltf') {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        onDone(gltf.scene, gltf.animations || []);
      }, undefined, reject);
    } else {
      URL.revokeObjectURL(url);
      reject(new Error('Formato não suportado. Use .fbx, .glb ou .gltf'));
    }
  });
}

// ─── Character ────────────────────────────────────────────────
async function loadCharacter(file) {
  showLoading(true);
  setStatus('Carregando personagem...');
  try {
    if (state.character) {
      scene.remove(state.character);
      if (state.mixer) {
        state.mixer.stopAllAction();
        state.mixer = null;
      }
      state.currentAction = null;
      state.character = null;
      state.bones = [];
      state.animations = [];
    }

    if (state.object && state.attachedBone) {
      detachObject();
    }

    const { object, animations } = await loadModel(file);
    enableShadows(object);

    state.charBaseScale = autoScaleAndPlace(object, 2.0);
    scene.add(object);
    state.character = object;
    state.bones = collectBones(object);
    state.animations = animations;

    if (animations.length > 0) {
      state.mixer = new THREE.AnimationMixer(object);
    }

    populateBones();
    populateAnims();
    updateTransformUI();
    focusOn(object);

    btnPlay.disabled = animations.length === 0;
    btnStop.disabled = animations.length === 0;
    boneSelect.disabled = state.bones.length === 0;
    btnAttach.disabled = !state.object || state.bones.length === 0;

    setStatus(`Personagem: ${file.name} · ${state.bones.length} ossos · ${animations.length} anim.`);
  } catch (err) {
    console.error(err);
    setStatus('Erro ao carregar personagem');
    alert(err.message || 'Falha ao carregar o arquivo');
  } finally {
    showLoading(false);
  }
}

// ─── Object ───────────────────────────────────────────────────
async function loadObject(file) {
  showLoading(true);
  setStatus('Carregando objeto...');
  try {
    if (state.object) {
      if (state.attachedBone) {
        state.attachedBone.remove(state.object);
      } else {
        scene.remove(state.object);
      }
      state.object = null;
      state.attachedBone = null;
    }

    const { object } = await loadModel(file);
    enableShadows(object);

    state.objBaseScale = autoScaleAndPlace(object, 0.4);
    object.position.set(0.6, object.position.y, 0);

    scene.add(object);
    state.object = object;
    state.attachedBone = null;

    btnAttach.disabled = !state.character || state.bones.length === 0;
    btnDetach.disabled = true;
    selObj.checked = true;
    state.selected = 'object';
    updateTransformUI();

    setStatus(`Objeto: ${file.name}`);
  } catch (err) {
    console.error(err);
    setStatus('Erro ao carregar objeto');
    alert(err.message || 'Falha ao carregar o arquivo');
  } finally {
    showLoading(false);
  }
}

// ─── Bones UI ─────────────────────────────────────────────────
function populateBones() {
  boneSelect.innerHTML = '';
  if (state.bones.length === 0) {
    boneSelect.innerHTML = '<option value="">Nenhum osso</option>';
    return;
  }

  const preferred = ['RightHand', 'LeftHand', 'mixamorigRightHand', 'mixamorigLeftHand',
    'RightHandIndex1', 'LeftHandIndex1', 'Head', 'Spine', 'Hips'];

  const sorted = [...state.bones].sort((a, b) => {
    const ai = preferred.indexOf(a.name);
    const bi = preferred.indexOf(b.name);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  sorted.forEach((bone) => {
    const opt = document.createElement('option');
    opt.value = bone.name;
    opt.textContent = bone.name;
    if (bone.name === 'RightHand' || bone.name === 'mixamorigRightHand') {
      opt.selected = true;
    }
    boneSelect.appendChild(opt);
  });
}

function findBone(name) {
  return state.bones.find((b) => b.name === name) || null;
}

// ─── Attach / Detach ──────────────────────────────────────────
function attachObject() {
  if (!state.object || !state.character) return;
  const boneName = boneSelect.value;
  const bone = findBone(boneName);
  if (!bone) {
    alert('Osso não encontrado');
    return;
  }

  if (state.object.parent) {
    state.object.parent.remove(state.object);
  }

  bone.add(state.object);
  state.object.position.set(0, 0, 0);
  state.object.rotation.set(0, 0, 0);
  state.object.scale.setScalar(1);

  state.objBaseScale = state.object.scale.x;

  state.attachedBone = bone;
  btnDetach.disabled = false;
  selObj.checked = true;
  state.selected = 'object';
  updateTransformUI();
  setStatus(`Objeto anexado a: ${bone.name}`);
}

function detachObject() {
  if (!state.object || !state.attachedBone) return;

  state.object.updateMatrixWorld(true);
  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  state.object.matrixWorld.decompose(worldPos, worldQuat, worldScale);

  state.attachedBone.remove(state.object);
  scene.add(state.object);

  state.object.position.copy(worldPos);
  state.object.quaternion.copy(worldQuat);
  state.object.scale.copy(worldScale);

  state.objBaseScale = worldScale.x;
  state.attachedBone = null;
  btnDetach.disabled = true;
  updateTransformUI();
  setStatus('Objeto desanexado');
}

// ─── Animations ───────────────────────────────────────────────
function populateAnims() {
  animSelect.innerHTML = '';
  if (state.animations.length === 0) {
    animSelect.innerHTML = '<option value="">Nenhuma animação</option>';
    animSelect.disabled = true;
    return;
  }
  animSelect.disabled = false;
  state.animations.forEach((clip, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = clip.name || `Animação ${i + 1}`;
    animSelect.appendChild(opt);
  });
}

function playAnimation(index) {
  if (!state.mixer || !state.animations[index]) return;
  if (state.currentAction) {
    state.currentAction.fadeOut(0.2);
  }
  const action = state.mixer.clipAction(state.animations[index]);
  action.reset().fadeIn(0.2).play();
  state.currentAction = action;
  btnPlay.textContent = '⏸ Pause';
  setStatus(`Animação: ${state.animations[index].name || index}`);
}

function togglePlay() {
  if (!state.mixer || !state.currentAction) {
    if (state.animations.length > 0) {
      playAnimation(0);
      animSelect.value = '0';
    }
    return;
  }
  if (state.currentAction.paused) {
    state.currentAction.paused = false;
    btnPlay.textContent = '⏸ Pause';
  } else {
    state.currentAction.paused = true;
    btnPlay.textContent = '▶ Play';
  }
}

function stopAnimation() {
  if (state.currentAction) {
    state.currentAction.fadeOut(0.15);
    state.currentAction = null;
  }
  if (state.mixer) {
    state.mixer.stopAllAction();
  }
  btnPlay.textContent = '▶ Play';
  setStatus('Animação parada');
}

// ─── Transform UI ─────────────────────────────────────────────
function getSelectedObject() {
  if (state.selected === 'object' && state.object) return state.object;
  if (state.selected === 'character' && state.character) return state.character;
  return null;
}

function getBaseScale() {
  return state.selected === 'object' ? state.objBaseScale : state.charBaseScale;
}

function updateTransformUI() {
  const obj = getSelectedObject();
  if (!obj) {
    sizePct.value = 100;
    return;
  }

  posX.value = +obj.position.x.toFixed(3);
  posY.value = +obj.position.y.toFixed(3);
  posZ.value = +obj.position.z.toFixed(3);

  rotX.value = +(obj.rotation.x * 180 / Math.PI).toFixed(1);
  rotY.value = +(obj.rotation.y * 180 / Math.PI).toFixed(1);
  rotZ.value = +(obj.rotation.z * 180 / Math.PI).toFixed(1);

  const base = getBaseScale() || 1;
  const pct = Math.round((obj.scale.x / base) * 100);
  sizePct.value = pct;
}

function applyPosition() {
  const obj = getSelectedObject();
  if (!obj) return;
  obj.position.set(
    parseFloat(posX.value) || 0,
    parseFloat(posY.value) || 0,
    parseFloat(posZ.value) || 0
  );
}

function applyRotation() {
  const obj = getSelectedObject();
  if (!obj) return;
  obj.rotation.set(
    (parseFloat(rotX.value) || 0) * Math.PI / 180,
    (parseFloat(rotY.value) || 0) * Math.PI / 180,
    (parseFloat(rotZ.value) || 0) * Math.PI / 180
  );
}

function applySize() {
  const obj = getSelectedObject();
  if (!obj) return;
  const pct = Math.max(1, parseFloat(sizePct.value) || 100);
  const base = getBaseScale() || 1;
  const s = base * (pct / 100);
  obj.scale.setScalar(s);
}

// ─── Brightness ───────────────────────────────────────────────
function changeBrightness(delta) {
  state.exposure = Math.max(0.2, Math.min(3.5, state.exposure + delta));
  renderer.toneMappingExposure = state.exposure;
  brightLabel.textContent = `Exposição: ${state.exposure.toFixed(2)}`;
}

// ─── Event listeners ──────────────────────────────────────────
charInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) loadCharacter(file);
  e.target.value = '';
});

objInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) loadObject(file);
  e.target.value = '';
});

animSelect.addEventListener('change', () => {
  const idx = parseInt(animSelect.value, 10);
  if (!isNaN(idx)) playAnimation(idx);
});

btnPlay.addEventListener('click', togglePlay);
btnStop.addEventListener('click', stopAnimation);
btnAttach.addEventListener('click', attachObject);
btnDetach.addEventListener('click', detachObject);

btnBrightUp.addEventListener('click', () => changeBrightness(0.15));
btnBrightDown.addEventListener('click', () => changeBrightness(-0.15));

selChar.addEventListener('change', () => {
  if (selChar.checked) {
    state.selected = 'character';
    updateTransformUI();
  }
});
selObj.addEventListener('change', () => {
  if (selObj.checked) {
    state.selected = 'object';
    updateTransformUI();
  }
});

[posX, posY, posZ].forEach((el) => {
  el.addEventListener('change', applyPosition);
  el.addEventListener('input', applyPosition);
});
[rotX, rotY, rotZ].forEach((el) => {
  el.addEventListener('change', applyRotation);
  el.addEventListener('input', applyRotation);
});
sizePct.addEventListener('change', applySize);
sizePct.addEventListener('input', applySize);

// ─── Animation loop ───────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (state.mixer) state.mixer.update(delta);
  controls.update();
  renderer.render(scene, camera);
}
animate();

setStatus('Pronto — importe um personagem .fbx / .glb');
