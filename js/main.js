import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { SkeletonHelper } from 'three';

// ===================== STATE =====================
const state = {
  character: null,
  skeleton: null,
  bones: [],
  objects: [],
  selectedObject: null,
  selectedBone: null,
  mixer: null,
  actions: {},
  currentAction: null,
  clock: new THREE.Clock(),
  showGrid: true,
  showSkeleton: false,
  showAxes: true,
  space: 'local',
  exposure: 1.4,
};

// ===================== SCENE SETUP =====================
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = state.exposure;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1e28);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
camera.position.set(0, 1.5, 4);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 1, 0);
controls.update();

const transformControls = new TransformControls(camera, canvas);
transformControls.setMode('translate');
transformControls.setSpace('local');
scene.add(transformControls.getHelper());

transformControls.addEventListener('dragging-changed', (e) => {
  controls.enabled = !e.value;
});

transformControls.addEventListener('objectChange', () => {
  updatePropertiesPanel();
});

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
dirLight.position.set(4, 8, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 40;
dirLight.shadow.camera.left = -8;
dirLight.shadow.camera.right = 8;
dirLight.shadow.camera.top = 8;
dirLight.shadow.camera.bottom = -8;
scene.add(dirLight);

const fill = new THREE.DirectionalLight(0xffffff, 0.9);
fill.position.set(-3, 2, -4);
scene.add(fill);

// Helpers
const grid = new THREE.GridHelper(20, 40, 0x444b5a, 0x2a3140);
scene.add(grid);

const axes = new THREE.AxesHelper(1.5);
axes.position.y = 0.01;
scene.add(axes);

let skeletonHelper = null;

// ===================== BRILHO + BOTÕES EXTRA =====================
function adjustBrightness(delta) {
  state.exposure = Math.max(0.4, Math.min(3.5, state.exposure + delta));
  renderer.toneMappingExposure = state.exposure;
  setStatus(`Brilho: ${state.exposure.toFixed(1)}`);
}

function createExtraButtons() {
  let toolbarRight = document.querySelector('.toolbar-right');

  if (!toolbarRight) {
    toolbarRight = document.querySelector('.toolbar') || document.body;
    console.warn('Elemento .toolbar-right não encontrado. Usando fallback.');
  }

  // Evita duplicar
  if (document.getElementById('btn-brightness-up')) return;

  // Botão Personagem
  const btnChar = document.createElement('button');
  btnChar.id = 'btn-select-character';
  btnChar.className = 'btn';
  btnChar.textContent = 'Personagem';
  btnChar.addEventListener('click', () => {
    if (state.character) {
      selectObject(state.character);
      setStatus('Personagem selecionado');
    } else {
      alert('Nenhum personagem carregado.');
    }
  });

  // Botão Brilho -
  const btnDown = document.createElement('button');
  btnDown.id = 'btn-brightness-down';
  btnDown.className = 'btn';
  btnDown.textContent = 'Brilho -';
  btnDown.title = 'Diminuir brilho';
  btnDown.addEventListener('click', () => adjustBrightness(-0.25));

  // Botão Brilho +
  const btnUp = document.createElement('button');
  btnUp.id = 'btn-brightness-up';
  btnUp.className = 'btn';
  btnUp.textContent = 'Brilho +';
  btnUp.title = 'Aumentar brilho';
  btnUp.addEventListener('click', () => adjustBrightness(0.25));

  if (toolbarRight.firstChild) {
    toolbarRight.insertBefore(btnUp, toolbarRight.firstChild);
    toolbarRight.insertBefore(btnDown, toolbarRight.firstChild);
    toolbarRight.insertBefore(btnChar, toolbarRight.firstChild);
  } else {
    toolbarRight.appendChild(btnChar);
    toolbarRight.appendChild(btnDown);
    toolbarRight.appendChild(btnUp);
  }
}

// ===================== LOADERS =====================
const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();

function loadModel(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop().toLowerCase();

    const onLoad = (result) => {
      URL.revokeObjectURL(url);
      let root;
      if (result.scene) {
        root = result.scene;
        root.animations = result.animations || [];
      } else {
        root = result;
      }
      root.name = file.name.replace(/\.[^/.]+$/, '');
      resolve(root);
    };

    const onError = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    if (ext === 'glb' || ext === 'gltf') {
      gltfLoader.load(url, onLoad, undefined, onError);
    } else if (ext === 'fbx') {
      fbxLoader.load(url, onLoad, undefined, onError);
    } else {
      reject(new Error('Formato não suportado. Use .glb, .gltf ou .fbx'));
    }
  });
}

// ===================== DETECTAR OSSOS =====================
function detectBones(root) {
  const bonesMap = new Map();

  root.traverse((c) => {
    if (c.isSkinnedMesh && c.skeleton && c.skeleton.bones) {
      c.skeleton.bones.forEach((bone) => {
        if (bone && bone.name) bonesMap.set(bone.uuid, bone);
      });
    }
    if (c.isBone && c.name) {
      bonesMap.set(c.uuid, c);
    }
  });

  return Array.from(bonesMap.values());
}

// ===================== CHARACTER =====================
async function importCharacter(file) {
  setStatus('Carregando personagem...');
  try {
    const root = await loadModel(file);

    clearScene();

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    root.position.y += size.y / 2;

    root.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });

    scene.add(root);
    state.character = root;

    state.bones = detectBones(root);

    if (state.bones.length > 0) {
      root.traverse((c) => {
        if (c.isSkinnedMesh && c.skeleton) {
          state.skeleton = c.skeleton;
        }
      });

      skeletonHelper = new SkeletonHelper(root);
      skeletonHelper.visible = state.showSkeleton;
      scene.add(skeletonHelper);

      setStatus(`Personagem carregado • ${state.bones.length} ossos encontrados`);
    } else {
      state.skeleton = null;
      setStatus('Personagem carregado (nenhum osso detectado)');
      alert('Nenhum osso foi detectado neste personagem.\nTente um modelo com esqueleto (ex: Mixamo).');
    }

    if (root.animations && root.animations.length > 0) {
      state.mixer = new THREE.AnimationMixer(root);
      state.actions = {};
      root.animations.forEach((clip) => {
        state.actions[clip.name] = state.mixer.clipAction(clip);
      });
      buildAnimationsPanel();
    } else {
      state.mixer = null;
      state.actions = {};
      buildAnimationsPanel();
    }

    buildHierarchy();
    buildBonesList();
    focusObject(root);
  } catch (err) {
    console.error(err);
    setStatus('Erro ao carregar');
    alert('Não foi possível carregar este arquivo.\n' + (err.message || err));
  }
}

// ===================== OBJECT =====================
async function importObject(file) {
  setStatus('Carregando objeto...');
  try {
    const root = await loadModel(file);

    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);

    root.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });

    scene.add(root);
    state.objects.push({ root, name: root.name, bone: null });

    selectObject(root);
    buildHierarchy();
    setStatus(`Objeto "${root.name}" importado`);
  } catch (err) {
    console.error(err);
    setStatus('Erro ao carregar objeto');
    alert('Não foi possível carregar este arquivo.\n' + (err.message || err));
  }
}

// ===================== ATTACH / DETACH (CORRIGIDO) =====================
function attachToBone() {
  if (!state.selectedObject) {
    alert('Selecione um objeto primeiro.');
    return;
  }
  if (!state.selectedBone) {
    alert('Selecione um osso primeiro.\nAbra a aba "Ossos" e toque no osso desejado.');
    return;
  }

  const obj = state.selectedObject;
  const bone = state.selectedBone;

  // Desanexa o TransformControls ANTES de mudar a hierarquia
  transformControls.detach();

  // Anexa o objeto ao osso (mantém a transformação mundial)
  bone.attach(obj);

  const entry = state.objects.find(o => o.root === obj);
  if (entry) entry.bone = bone;

  // Reanexa o TransformControls
  transformControls.attach(obj);

  buildHierarchy();
  updatePropertiesPanel();
  setStatus(`"${obj.name}" anexado a "${bone.name}"`);
}

function detachObject() {
  if (!state.selectedObject) {
    alert('Selecione um objeto primeiro.');
    return;
  }

  const obj = state.selectedObject;

  // Desanexa o controle primeiro
  transformControls.detach();

  // Volta para a cena (mantém transformação mundial)
  scene.attach(obj);

  const entry = state.objects.find(o => o.root === obj);
  if (entry) entry.bone = null;

  // Reanexa o controle
  transformControls.attach(obj);

  buildHierarchy();
  updatePropertiesPanel();
  setStatus(`"${obj.name}" desanexado`);
}

// ===================== SELECTION =====================
function selectObject(obj) {
  state.selectedObject = obj;

  if (obj) {
    transformControls.attach(obj);
  } else {
    transformControls.detach();
  }

  highlightHierarchy();
  updatePropertiesPanel();
}

function selectBone(bone) {
  state.selectedBone = bone;
  highlightBonesList();
  highlightHierarchy();
  updatePropertiesPanel();
  setStatus(`Osso: ${bone.name}`);
}

// ===================== UI =====================
function buildHierarchy() {
  const list = document.getElementById('hierarchy-list');
  if (!list) return;
  list.innerHTML = '';

  if (state.character) {
    const charLi = createTreeItem(state.character.name || 'Character', state.character);
    list.appendChild(charLi);

    if (state.bones.length) {
      const armatureLi = document.createElement('li');
      armatureLi.innerHTML = `<span class="toggle">▼</span> Armature (${state.bones.length} ossos)`;
      list.appendChild(armatureLi);
    }
  }

  state.objects.forEach(entry => {
    const li = createTreeItem(entry.name, entry.root);
    if (entry.bone) {
      li.innerHTML += ` <span class="muted">→ ${entry.bone.name}</span>`;
    }
    list.appendChild(li);
  });
}

function createTreeItem(name, obj) {
  const li = document.createElement('li');
  li.textContent = name;
  li.dataset.uuid = obj.uuid;
  li.style.padding = '10px 8px';
  li.addEventListener('click', (e) => {
    e.stopPropagation();
    selectObject(obj);
  });
  return li;
}

function buildBonesList() {
  const list = document.getElementById('bones-list');
  if (!list) return;
  list.innerHTML = '';

  if (!state.bones.length) {
    list.innerHTML = '<li class="muted" style="padding:12px 8px;">Nenhum osso detectado.<br>Importe um personagem com esqueleto (Mixamo, etc).</li>';
    return;
  }

  const sorted = [...state.bones].sort((a, b) => a.name.localeCompare(b.name));

  sorted.forEach(bone => {
    const li = document.createElement('li');
    li.textContent = bone.name;
    li.dataset.uuid = bone.uuid;
    li.style.padding = '12px 10px';
    li.style.fontSize = '14px';
    li.style.borderBottom = '1px solid #2a3140';
    li.style.cursor = 'pointer';

    li.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectBone(bone);

      document.querySelectorAll('#bones-list li').forEach(el => el.classList.remove('selected'));
      li.classList.add('selected');
    });

    list.appendChild(li);
  });
}

function highlightHierarchy() {
  document.querySelectorAll('#hierarchy-list li').forEach(li => {
    li.classList.toggle('selected',
      (state.selectedObject && li.dataset.uuid === state.selectedObject.uuid) ||
      (state.selectedBone && li.dataset.uuid === state.selectedBone.uuid)
    );
  });
}

function highlightBonesList() {
  document.querySelectorAll('#bones-list li').forEach(li => {
    li.classList.toggle('selected', state.selectedBone && li.dataset.uuid === state.selectedBone.uuid);
  });
}

function updatePropertiesPanel() {
  const container = document.getElementById('properties-content');
  if (!container) return;

  const obj = state.selectedObject;
  const bone = state.selectedBone;

  if (!obj && !bone) {
    container.innerHTML = '<p class="muted">Nenhum objeto selecionado</p>';
    return;
  }

  if (bone && !obj) {
    container.innerHTML = `
      <div class="prop-row"><label>Osso</label><input type="text" value="${bone.name}" readonly /></div>
      <p class="muted" style="margin-top:10px">Osso selecionado.<br>Agora selecione a arma e clique em <b>Anexar ao Osso</b>.</p>
    `;
    return;
  }

  const currentSize = Math.round(((obj.scale.x + obj.scale.y + obj.scale.z) / 3) * 100);
  const pos = obj.position;
  const rot = obj.rotation;
  const parentName = obj.parent && obj.parent.isBone ? obj.parent.name : (obj.parent === scene ? 'Scene' : (obj.parent?.name || '—'));

  container.innerHTML = `
    <div class="prop-row"><label>Nome</label><input type="text" id="prop-name" value="${obj.name}" /></div>
    <div class="prop-row"><label>Parent</label><input type="text" value="${parentName}" readonly /></div>

    <div class="prop-row" style="margin-top:12px;">
      <label style="width:70px;">Tamanho</label>
      <input type="number" id="prop-size" value="${currentSize}" step="5" min="1" max="500" style="flex:1; font-size:16px; padding:10px;" />
    </div>
    <p class="muted" style="margin:4px 0 10px 0; font-size:11px;">
      100 = original | 50 = metade | 30 = pequeno
    </p>

    <div class="prop-row">
      <label>Posição</label>
      <div class="vec3">
        <input type="number" step="0.01" id="prop-px" value="${pos.x.toFixed(3)}" />
        <input type="number" step="0.01" id="prop-py" value="${pos.y.toFixed(3)}" />
        <input type="number" step="0.01" id="prop-pz" value="${pos.z.toFixed(3)}" />
      </div>
    </div>
    <div class="prop-row">
      <label>Rotação</label>
      <div class="vec3">
        <input type="number" step="1" id="prop-rx" value="${THREE.MathUtils.radToDeg(rot.x).toFixed(0)}" />
        <input type="number" step="1" id="prop-ry" value="${THREE.MathUtils.radToDeg(rot.y).toFixed(0)}" />
        <input type="number" step="1" id="prop-rz" value="${THREE.MathUtils.radToDeg(rot.z).toFixed(0)}" />
      </div>
    </div>

    <div style="margin-top:12px; display:flex; gap:8px;">
      <button class="btn small" id="btn-apply-props" style="flex:1; padding:12px;">Aplicar</button>
      <button class="btn small" id="btn-reset-props" style="padding:12px;">Resetar</button>
    </div>
  `;

  document.getElementById('btn-apply-props')?.addEventListener('click', applyProperties);
  document.getElementById('btn-reset-props')?.addEventListener('click', () => {
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    obj.scale.set(1, 1, 1);
    updatePropertiesPanel();
  });

  document.getElementById('prop-size')?.addEventListener('change', applyProperties);
  document.getElementById('prop-size')?.addEventListener('input', applyProperties);
}

function applyProperties() {
  const obj = state.selectedObject;
  if (!obj) return;

  const sizeInput = document.getElementById('prop-size');
  if (sizeInput) {
    let size = parseFloat(sizeInput.value) || 100;
    size = Math.max(1, Math.min(500, size));
    const scale = size / 100;
    obj.scale.set(scale, scale, scale);
  }

  const px = parseFloat(document.getElementById('prop-px')?.value) || 0;
  const py = parseFloat(document.getElementById('prop-py')?.value) || 0;
  const pz = parseFloat(document.getElementById('prop-pz')?.value) || 0;
  obj.position.set(px, py, pz);

  const rx = THREE.MathUtils.degToRad(parseFloat(document.getElementById('prop-rx')?.value) || 0);
  const ry = THREE.MathUtils.degToRad(parseFloat(document.getElementById('prop-ry')?.value) || 0);
  const rz = THREE.MathUtils.degToRad(parseFloat(document.getElementById('prop-rz')?.value) || 0);
  obj.rotation.set(rx, ry, rz);

  const nameEl = document.getElementById('prop-name');
  if (nameEl && nameEl.value) {
    obj.name = nameEl.value;
    const entry = state.objects.find(o => o.root === obj);
    if (entry) entry.name = nameEl.value;
    buildHierarchy();
  }
}

function buildAnimationsPanel() {
  const container = document.getElementById('animations-content');
  const controlsEl = document.getElementById('anim-controls');
  if (!container || !controlsEl) return;

  const names = Object.keys(state.actions);
  if (!names.length) {
    container.innerHTML = '<p class="muted">Nenhuma animação</p>';
    controlsEl.classList.add('hidden');
    return;
  }

  container.innerHTML = '';
  names.forEach(name => {
    const div = document.createElement('div');
    div.className = 'anim-item';
    div.textContent = name;
    div.style.padding = '10px 8px';
    div.addEventListener('click', () => playAnimation(name));
    container.appendChild(div);
  });
  controlsEl.classList.remove('hidden');
}

function playAnimation(name) {
  if (!state.mixer || !state.actions[name]) return;

  Object.values(state.actions).forEach(a => a.stop());
  state.currentAction = state.actions[name];
  state.currentAction.reset().play();

  document.querySelectorAll('.anim-item').forEach(el => {
    el.classList.toggle('active', el.textContent === name);
  });
  setStatus(`Animação: ${name}`);
}

// ===================== HELPERS =====================
function clearScene() {
  if (state.character) {
    scene.remove(state.character);
    disposeObject(state.character);
    state.character = null;
  }
  state.objects.forEach(o => {
    scene.remove(o.root);
    disposeObject(o.root);
  });
  state.objects = [];

  if (skeletonHelper) {
    scene.remove(skeletonHelper);
    skeletonHelper = null;
  }

  state.skeleton = null;
  state.bones = [];
  state.mixer = null;
  state.actions = {};
  state.currentAction = null;
  state.selectedObject = null;
  state.selectedBone = null;
  transformControls.detach();

  buildHierarchy();
  buildBonesList();
  buildAnimationsPanel();
  updatePropertiesPanel();
}

function disposeObject(obj) {
  obj.traverse((c) => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) {
      if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
      else c.material.dispose();
    }
  });
}

function focusObject(obj) {
  if (!obj) return;
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim * 2.2;

  camera.position.set(center.x + dist * 0.6, center.y + dist * 0.4, center.z + dist * 0.8);
  controls.target.copy(center);
  controls.update();
}

function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
}

// ===================== EXPORT =====================
function exportGLB() {
  if (!state.character && state.objects.length === 0) {
    alert('Nada para exportar.');
    return;
  }

  const exporter = new GLTFExporter();
  const exportRoot = new THREE.Group();
  exportRoot.name = 'Export';

  if (state.character) exportRoot.add(state.character.clone(true));
  state.objects.forEach(o => exportRoot.add(o.root.clone(true)));

  exporter.parse(
    exportRoot,
    (result) => {
      const blob = new Blob([result], { type: 'application/octet-stream' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'character_export.glb';
      link.click();
      URL.revokeObjectURL(link.href);
      setStatus('GLB exportado');
    },
    (err) => {
      console.error(err);
      alert('Erro ao exportar GLB.');
    },
    { binary: true, animations: state.character?.animations || [] }
  );
}

// ===================== EVENTS =====================
document.getElementById('btn-import-character')?.addEventListener('click', () => {
  document.getElementById('file-character').click();
});
document.getElementById('file-character')?.addEventListener('change', (e) => {
  if (e.target.files[0]) importCharacter(e.target.files[0]);
  e.target.value = '';
});

document.getElementById('btn-import-object')?.addEventListener('click', () => {
  document.getElementById('file-object').click();
});
document.getElementById('file-object')?.addEventListener('change', (e) => {
  if (e.target.files[0]) importObject(e.target.files[0]);
  e.target.value = '';
});

document.getElementById('btn-attach')?.addEventListener('click', attachToBone);
document.getElementById('btn-detach')?.addEventListener('click', detachObject);
document.getElementById('btn-export')?.addEventListener('click', exportGLB);
document.getElementById('btn-new')?.addEventListener('click', () => {
  if (confirm('Limpar cena atual?')) clearScene();
});

document.getElementById('mode-translate')?.addEventListener('click', () => setMode('translate'));
document.getElementById('mode-rotate')?.addEventListener('click', () => setMode('rotate'));
document.getElementById('mode-scale')?.addEventListener('click', () => setMode('scale'));

function setMode(mode) {
  transformControls.setMode(mode);
  document.querySelectorAll('.transform-modes .btn-icon').forEach(b => b.classList.remove('active'));
  document.getElementById('mode-' + mode)?.classList.add('active');
}

document.getElementById('btn-space')?.addEventListener('click', () => {
  state.space = state.space === 'local' ? 'world' : 'local';
  transformControls.setSpace(state.space);
  document.getElementById('btn-space').textContent = state.space === 'local' ? 'Local' : 'World';
});

document.getElementById('btn-grid')?.addEventListener('click', toggleGrid);
document.getElementById('chk-grid')?.addEventListener('change', (e) => {
  state.showGrid = e.target.checked;
  grid.visible = state.showGrid;
  document.getElementById('btn-grid')?.classList.toggle('active', state.showGrid);
});
function toggleGrid() {
  state.showGrid = !state.showGrid;
  grid.visible = state.showGrid;
  document.getElementById('chk-grid').checked = state.showGrid;
  document.getElementById('btn-grid')?.classList.toggle('active', state.showGrid);
}

document.getElementById('btn-skeleton')?.addEventListener('click', toggleSkeleton);
document.getElementById('chk-skeleton')?.addEventListener('change', (e) => {
  state.showSkeleton = e.target.checked;
  if (skeletonHelper) skeletonHelper.visible = state.showSkeleton;
  document.getElementById('btn-skeleton')?.classList.toggle('active', state.showSkeleton);
});
function toggleSkeleton() {
  state.showSkeleton = !state.showSkeleton;
  if (skeletonHelper) skeletonHelper.visible = state.showSkeleton;
  document.getElementById('chk-skeleton').checked = state.showSkeleton;
  document.getElementById('btn-skeleton')?.classList.toggle('active', state.showSkeleton);
}

document.getElementById('btn-axes')?.addEventListener('click', () => {
  state.showAxes = !state.showAxes;
  axes.visible = state.showAxes;
  document.getElementById('chk-axes').checked = state.showAxes;
  document.getElementById('btn-axes')?.classList.toggle('active', state.showAxes);
});
document.getElementById('chk-axes')?.addEventListener('change', (e) => {
  state.showAxes = e.target.checked;
  axes.visible = state.showAxes;
  document.getElementById('btn-axes')?.classList.toggle('active', state.showAxes);
});

document.getElementById('chk-wireframe')?.addEventListener('change', (e) => {
  const wire = e.target.checked;
  scene.traverse((c) => {
    if (c.isMesh && c.material) {
      if (Array.isArray(c.material)) c.material.forEach(m => m.wireframe = wire);
      else c.material.wireframe = wire;
    }
  });
});

document.getElementById('btn-reset-camera')?.addEventListener('click', () => {
  camera.position.set(0, 1.5, 4);
  controls.target.set(0, 1, 0);
  controls.update();
});

document.getElementById('btn-focus')?.addEventListener('click', () => {
  focusObject(state.selectedObject || state.character);
});

document.getElementById('btn-play')?.addEventListener('click', () => {
  if (state.currentAction) state.currentAction.paused = false;
});
document.getElementById('btn-pause')?.addEventListener('click', () => {
  if (state.currentAction) state.currentAction.paused = true;
});
document.getElementById('btn-stop')?.addEventListener('click', () => {
  if (state.currentAction) {
    state.currentAction.stop();
    state.currentAction = null;
  }
});

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById('tab-' + tab.dataset.tab);
    if (target) target.classList.add('active');
  });
});

// Busca de ossos
document.getElementById('search-bones')?.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  document.querySelectorAll('#bones-list li').forEach(li => {
    const text = li.textContent.toLowerCase();
    li.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'w' || e.key === 'W') setMode('translate');
  if (e.key === 'e' || e.key === 'E') setMode('rotate');
  if (e.key === 'r' || e.key === 'R') setMode('scale');
  if (e.key === 'f' || e.key === 'F') focusObject(state.selectedObject || state.character);
});

document.getElementById('toggle-left')?.addEventListener('click', () => {
  document.getElementById('panel-left')?.classList.toggle('open');
  document.getElementById('panel-right')?.classList.remove('open');
});
document.getElementById('toggle-right')?.addEventListener('click', () => {
  document.getElementById('panel-right')?.classList.toggle('open');
  document.getElementById('panel-left')?.classList.remove('open');
});

function onResize() {
  const container = document.getElementById('viewport-container');
  if (!container) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);
onResize();

// ===================== RENDER LOOP =====================
let lastTime = performance.now();
let frames = 0;

function animate() {
  requestAnimationFrame(animate);

  const delta = state.clock.getDelta();
  if (state.mixer) state.mixer.update(delta);

  controls.update();
  renderer.render(scene, camera);

  frames++;
  const now = performance.now();
  if (now >= lastTime + 1000) {
    const fps = Math.round((frames * 1000) / (now - lastTime));
    const fpsEl = document.getElementById('fps');
    if (fpsEl) fpsEl.textContent = fps + ' FPS';
    frames = 0;
    lastTime = now;
  }
}
animate();

// Criar botões extras depois que a página carregou
createExtraButtons();
setStatus('Pronto — Importe um personagem para começar');
