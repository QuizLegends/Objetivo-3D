import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export class ThreeManager {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private transformControls: TransformControls;
  private dirLight: THREE.DirectionalLight;
  private ambLight: THREE.AmbientLight;

  private mixer: THREE.AnimationMixer | null = null;
  private clock: THREE.Clock;
  private currentAction: THREE.AnimationAction | null = null;

  private characterModel: THREE.Object3D | null = null;
  private currentProp: THREE.Object3D | null = null;
  private attachedBone: THREE.Object3D | null = null;
  
  private characterAnimations: THREE.AnimationClip[] = [];
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private isTouchDragging: boolean = false;

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

    // Controles de Transformação (Gizmo de toque)
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.setMode('translate');
    this.transformControls.setSize(0.85);
    
    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.controls.enabled = !event.value;
      this.isTouchDragging = event.value;
    });

    this.scene.add(this.transformControls);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);

    // Iluminação
    this.ambLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(this.ambLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.dirLight.position.set(2, 4, 3);
    this.dirLight.castShadow = true;
    this.scene.add(this.dirLight);

    const grid = new THREE.GridHelper(10, 10, 0x1e293b, 0x0f172a);
    this.scene.add(grid);

    this.clock = new THREE.Clock();
    this.animate();
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.isTouchDragging || !this.currentProp) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.currentProp, true);

    if (intersects.length > 0) {
      this.selectProp();
    }
  };

  public selectProp() {
    if (this.currentProp) {
      this.transformControls.attach(this.currentProp);
    }
  }

  public deselectProp() {
    this.transformControls.detach();
  }

  public setTransformMode(mode: 'translate' | 'rotate' | 'scale') {
    this.transformControls.setMode(mode);
  }

  // Loop de Renderização & Atualização de Animação e Matrizes 3D
  private animate = () => {
    requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();

    if (this.mixer) {
      this.mixer.update(delta);
      // Força a atualização do esqueleto para sincronizar a posição dos ossos com os objetos filhos no mesmo frame
      if (this.characterModel) {
        this.characterModel.updateMatrixWorld(true);
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

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

  public loadProp(file: File, onLoaded: (prop: THREE.Object3D) => void) {
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();

    const handlePropLoad = (prop: THREE.Object3D) => {
      this.currentProp = prop;
      this.scene.add(prop); // Inicialmente adicionado à cena livremente
      this.selectProp();
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

  /**
   * FIXAR NO OSSO MANTENDO A POSIÇÃO RELATIVA EXATA:
   * Permite mover o objeto até a mão com o toque e fixar preservando o alinhamento correto.
   */
  public attachToBone(boneName: string) {
    if (!this.characterModel || !this.currentProp) return;

    let targetBone: THREE.Object3D | null = null;
    this.characterModel.traverse((child) => {
      if (child.name === boneName) {
        targetBone = child;
      }
    });

    if (targetBone) {
      this.attachedBone = targetBone;

      // Garante que a matriz de transformação do modelo e do osso estejam totalmente atualizadas
      this.characterModel.updateMatrixWorld(true);
      targetBone.updateMatrixWorld(true);

      // Desativa temporariamente o TransformControls para fazer a reparentalização sem conflito de eixos
      this.deselectProp();

      // Transfere o objeto para o osso mantendo a posição e rotação relativas do momento em que foi fixado
      targetBone.attach(this.currentProp);

      // Reativa o TransformControls no objeto dentro da nova hierarquia do osso
      this.selectProp();
    }
  }

  // Soltar o objeto de volta para a cena (livre do osso)
  public detachFromBone() {
    if (this.currentProp && this.attachedBone) {
      this.deselectProp();
      this.scene.attach(this.currentProp);
      this.attachedBone = null;
      this.selectProp();
    }
  }

  // CONTROLES MANUAIS (Translação / Escala / Rotação)
  public movePropX(delta: number) {
    if (this.currentProp) this.currentProp.position.x += delta;
  }

  public movePropY(delta: number) {
    if (this.currentProp) this.currentProp.position.y += delta;
  }

  public movePropZ(delta: number) {
    if (this.currentProp) this.currentProp.position.z += delta;
  }

  public scaleProp(factor: number) {
    if (this.currentProp) {
      const newScale = Math.max(0.01, this.currentProp.scale.x * factor);
      this.currentProp.scale.set(newScale, newScale, newScale);
    }
  }

  public rotateProp(axis: 'x' | 'y' | 'z', degrees: number) {
    if (!this.currentProp) return;
    const rad = THREE.MathUtils.degToRad(degrees);
    if (axis === 'x') this.currentProp.rotation.x += rad;
    if (axis === 'y') this.currentProp.rotation.y += rad;
    if (axis === 'z') this.currentProp.rotation.z += rad;
  }

  // Animações
  public playAnimation(clip: THREE.AnimationClip) {
    if (!this.mixer) return;
    if (this.currentAction) {
      this.currentAction.stop();
    }
    this.currentAction = this.mixer.clipAction(clip);
    this.currentAction.play();
  }

  public stopAnimation() {
    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }
  }

  public setBrightness(val: number) {
    this.dirLight.intensity = val;
    this.ambLight.intensity = val * 0.7;
  }

  public setCharacterScale(percent: number) {
    if (!this.characterModel) return;
    const s = percent / 100;
    this.characterModel.scale.set(s, s, s);
  }

  public exportGLB() {
    if (!this.characterModel) {
      alert('Nenhum modelo carregado para exportar.');
      return;
    }

    this.deselectProp();

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
        this.selectProp();
      },
      (error) => {
        console.error('Erro ao exportar GLB:', error);
        this.selectProp();
      },
      { 
        binary: true,
        embedImages: true,
        animations: this.characterAnimations 
      }
    );
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public dispose() {
    this.renderer.dispose();
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
