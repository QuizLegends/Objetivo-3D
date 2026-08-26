import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export class ThreeManager {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private dirLight: THREE.DirectionalLight;
  private ambLight: THREE.AmbientLight;

  private mixer: THREE.AnimationMixer | null = null;
  private clock: THREE.Clock;
  private currentAction: THREE.AnimationAction | null = null;

  private characterModel: THREE.Object3D | null = null;
  private skeleton: THREE.Skeleton | null = null;
  private currentProp: THREE.Object3D | null = null;
  
  private characterAnimations: THREE.AnimationClip[] = [];

  constructor(container: HTMLElement) {
    this.container = container;

    // Configuração da Cena
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x071220);

    // Câmera
    const aspect = container.clientWidth / container.clientHeight || 1;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(0, 1.5, 3);

    // Renderizador
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    // Controles Orbitais
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1, 0);

    // Iluminação
    this.ambLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(this.ambLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.dirLight.position.set(2, 4, 3);
    this.dirLight.castShadow = true;
    this.scene.add(this.dirLight);

    // Grade Auxiliar
    const grid = new THREE.GridHelper(10, 10, 0x1e293b, 0x0f172a);
    this.scene.add(grid);

    this.clock = new THREE.Clock();
    this.animate();
  }

  // Loop de Renderização & Atualização das Animações
  private animate = () => {
    requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    if (this.mixer) {
      this.mixer.update(delta);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // Carregar Personagem (FBX ou GLB/GLTF)
  public loadCharacter(
    file: File,
    onLoaded: (bones: THREE.Bone[], anims: THREE.AnimationClip[]) => void
  ) {
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();

    const handleModelLoad = (model: THREE.Object3D, animations: THREE.AnimationClip[]) => {
      if (this.characterModel) {
        this.scene.remove(this.characterModel);
      }

      this.characterModel = model;
      this.scene.add(model);
      
      this.characterAnimations = animations;
      this.mixer = new THREE.AnimationMixer(model);

      const bones: THREE.Bone[] = [];
      model.traverse((child) => {
        if ((child as THREE.Bone).isBone) {
          bones.push(child as THREE.Bone);
        }
      });

      onLoaded(bones, animations);
      URL.revokeObjectURL(url);
    };

    if (ext === 'fbx') {
      const loader = new FBXLoader();
      loader.load(url, (fbx) => handleModelLoad(fbx, fbx.animations || []));
    } else if (ext === 'glb' || ext === 'gltf') {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => handleModelLoad(gltf.scene, gltf.animations || []));
    }
  }

  // Carregar Objeto / Arma (FBX ou GLB/GLTF)
  public loadProp(file: File, onLoaded: (prop: THREE.Object3D) => void) {
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();

    const handlePropLoad = (prop: THREE.Object3D) => {
      this.currentProp = prop;
      onLoaded(prop);
      URL.revokeObjectURL(url);
    };

    if (ext === 'fbx') {
      const loader = new FBXLoader();
      loader.load(url, (fbx) => handlePropLoad(fbx));
    } else if (ext === 'glb' || ext === 'gltf') {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => handlePropLoad(gltf.scene));
    }
  }

  // Aplicar Textura customizada no Objeto carregado
  public applyPropTexture(file: File) {
    if (!this.currentProp) return;
    const url = URL.createObjectURL(file);
    const textureLoader = new THREE.TextureLoader();

    textureLoader.load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      this.currentProp?.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.material = new THREE.MeshStandardMaterial({ map: texture });
        }
      });
      URL.revokeObjectURL(url);
    });
  }

  // Anexar Objeto a um Osso específico do esqueleto
  public attachToBone(prop: THREE.Object3D, boneName: string) {
    if (!this.characterModel) return;

    let targetBone: THREE.Object3D | null = null;
    this.characterModel.traverse((child) => {
      if (child.name === boneName) {
        targetBone = child;
      }
    });

    if (targetBone) {
      (targetBone as THREE.Object3D).add(prop);
      prop.position.set(0, 0, 0);
      prop.rotation.set(0, 0, 0);
    }
  }

  // --- CONTROLES DO OBJETO ---

  // Movimentação de Posição (X, Y, Z)
  public movePropX(delta: number) {
    if (this.currentProp) this.currentProp.position.x += delta;
  }

  public movePropY(delta: number) {
    if (this.currentProp) this.currentProp.position.y += delta;
  }

  public movePropZ(delta: number) {
    if (this.currentProp) this.currentProp.position.z += delta;
  }

  // Escala (Aumentar / Diminuir como um todo)
  public scaleProp(factor: number) {
    if (this.currentProp) {
      const newScale = Math.max(0.01, this.currentProp.scale.x * factor);
      this.currentProp.scale.set(newScale, newScale, newScale);
    }
  }

  // Rotação nos Eixos (graus)
  public rotateProp(axis: 'x' | 'y' | 'z', degrees: number) {
    if (!this.currentProp) return;
    const rad = THREE.MathUtils.degToRad(degrees);
    if (axis === 'x') this.currentProp.rotation.x += rad;
    if (axis === 'y') this.currentProp.rotation.y += rad;
    if (axis === 'z') this.currentProp.rotation.z += rad;
  }

  // Tocar Animação
  public playAnimation(clip: THREE.AnimationClip) {
    if (!this.mixer) return;
    if (this.currentAction) {
      this.currentAction.stop();
    }
    this.currentAction = this.mixer.clipAction(clip);
    this.currentAction.play();
  }

  // Parar Animação
  public stopAnimation() {
    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }
  }

  // Alterar Brilho da Iluminação
  public setBrightness(val: number) {
    this.dirLight.intensity = val;
    this.ambLight.intensity = val * 0.7;
  }

  // Alterar Escala do Personagem
  public setCharacterScale(percent: number) {
    if (!this.characterModel) return;
    const s = percent / 100;
    this.characterModel.scale.set(s, s, s);
  }

  // Exportar Modelo para arquivo .GLB
  public exportGLB() {
    if (!this.characterModel) {
      alert('Nenhum modelo carregado para exportar.');
      return;
    }

    const exporter = new GLTFExporter();
    exporter.parse(
      this.characterModel,
      (gltf) => {
        let blob: Blob;

        if (gltf instanceof ArrayBuffer) {
          blob = new Blob([gltf], { type: 'application/octet-stream' });
        } else {
          const output = JSON.stringify(gltf, null, 2);
          blob = new Blob([output], { type: 'application/json' });
        }

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'modelo_editado.glb';
        link.click();

        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      },
      (error) => {
        console.error('Erro ao exportar GLB:', error);
      },
      { 
        binary: true,
        embedImages: true,
        animations: this.characterAnimations 
      }
    );
  }

  // Redimensionar Canvas
  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // Limpar recursos ao desmontar componente React
  public dispose() {
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
