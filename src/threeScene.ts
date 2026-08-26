import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export class ThreeManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  mixer: THREE.AnimationMixer | null = null;
  currentAction: THREE.AnimationAction | null = null;
  clock = new THREE.Clock();
  
  characterGroup: THREE.Group;
  ambientLight: THREE.AmbientLight;
  dirLight: THREE.DirectionalLight;
  animId: number | null = null;

  constructor(container: HTMLDivElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0d1b2a');

    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 1.5, 4);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1, 0);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.dirLight.position.set(5, 10, 7);
    this.scene.add(this.ambientLight);
    this.scene.add(this.dirLight);

    const grid = new THREE.GridHelper(10, 20, 0x1e3a5f, 0x142843);
    this.scene.add(grid);

    this.characterGroup = new THREE.Group();
    this.scene.add(this.characterGroup);

    this.animate();
  }

  animate = () => {
    this.animId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    if (this.mixer) this.mixer.update(delta);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  loadCharacter(file: File, onLoad: (bones: THREE.Bone[], anims: THREE.AnimationClip[]) => void) {
    while (this.characterGroup.children.length > 0) {
      this.characterGroup.remove(this.characterGroup.children[0]);
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();

    const handleLoaded = (model: THREE.Object3D, animations: THREE.AnimationClip[]) => {
      this.characterGroup.add(model);
      this.mixer = new THREE.AnimationMixer(model);

      const bones: THREE.Bone[] = [];
      model.traverse((child) => {
        if ((child as THREE.Bone).isBone) bones.push(child as THREE.Bone);
      });

      URL.revokeObjectURL(url);
      onLoad(bones, animations);
    };

    if (ext === 'fbx') {
      new FBXLoader().load(url, (fbx) => handleLoaded(fbx, fbx.animations));
    } else if (ext === 'gltf' || ext === 'glb') {
      new GLTFLoader().load(url, (gltf) => handleLoaded(gltf.scene, gltf.animations));
    }
  }

  loadProp(file: File, onLoad: (obj: THREE.Object3D) => void) {
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();
    const done = (obj: THREE.Object3D) => {
      URL.revokeObjectURL(url);
      onLoad(obj);
    };

    if (ext === 'fbx') new FBXLoader().load(url, done);
    else if (ext === 'gltf' || ext === 'glb') new GLTFLoader().load(url, (gltf) => done(gltf.scene));
  }

  attachToBone(object: THREE.Object3D, boneName: string): boolean {
    let targetBone: THREE.Object3D | null = null;
    this.characterGroup.traverse((child) => {
      if (child.name === boneName) targetBone = child;
    });

    if (targetBone) {
      (targetBone as THREE.Object3D).add(object);
      object.position.set(0, 0, 0);
      object.rotation.set(0, 0, 0);
      object.scale.set(1, 1, 1);
      return true;
    }
    return false;
  }

  playAnimation(clip: THREE.AnimationClip) {
    if (!this.mixer) return;
    if (this.currentAction) this.currentAction.stop();
    this.currentAction = this.mixer.clipAction(clip);
    this.currentAction.play();
  }

  stopAnimation() {
    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }
  }

  setBrightness(val: number) {
    this.ambientLight.intensity = val;
    this.dirLight.intensity = val * 1.25;
  }

  setCharacterScale(percent: number) {
    const s = percent / 100;
    this.characterGroup.scale.set(s, s, s);
  }

  exportGLB() {
    new GLTFExporter().parse(
      this.characterGroup,
      (gltf) => {
        const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'personagem-editado.glb';
        link.click();
      },
      (err) => console.error(err),
      { binary: true }
    );
  }

  dispose() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.renderer.dispose();
  }
}
