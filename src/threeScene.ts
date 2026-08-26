import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export class ThreeManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  private mixer: THREE.AnimationMixer | null = null;
  private currentAction: THREE.AnimationAction | null = null;

  public characterGroup: THREE.Group | null = null;
  private characterModel: THREE.Object3D | null = null;
  public bones: THREE.Bone[] = [];
  public animations: THREE.AnimationClip[] = [];

  private clock = new THREE.Clock();
  private reqId: number | null = null;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x071220);

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.5, 3.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1, 0);

    // Iluminação reforçada para evitar objetos pretos/brancos sem textura
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
    this.hemiLight.position.set(0, 20, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.dirLight.position.set(3, 10, 10);
    this.dirLight.castShadow = true;
    this.scene.add(this.dirLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    this.animate();
  }

  private animate = () => {
    this.reqId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();

    if (this.mixer) {
      this.mixer.update(delta);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // Carregar Personagem
  public loadCharacter(file: File, callback: (bones: THREE.Bone[], anims: THREE.AnimationClip[]) => void) {
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (this.characterGroup) {
      this.scene.remove(this.characterGroup);
    }

    this.characterGroup = new THREE.Group();
    this.characterGroup.name = "ExportRoot";
    this.scene.add(this.characterGroup);

    const onModelLoaded = (model: THREE.Object3D, anims: THREE.AnimationClip[]) => {
      URL.revokeObjectURL(url);
      this.characterModel = model;
      this.characterGroup!.add(model);

      this.bones = [];
      model.traverse((child) => {
        if ((child as THREE.Bone).isBone) {
          this.bones.push(child as THREE.Bone);
        }
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.mixer = new THREE.AnimationMixer(model);
      this.animations = anims;

      // Importante: Guarda as animações na raiz para o exportador reconhecer
      this.characterGroup!.animations = anims;

      callback(this.bones, this.animations);
    };

    if (ext === 'fbx') {
      const loader = new FBXLoader();
      loader.load(url, (fbx) => onModelLoaded(fbx, fbx.animations || []));
    } else if (ext === 'glb' || ext === 'gltf') {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => onModelLoaded(gltf.scene, gltf.animations || []));
    }
  }

  // Carregar Objeto / Arma e preservar Texturas/Materiais
  public loadProp(file: File, callback: (obj: THREE.Object3D) => void) {
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();

    const processPropMaterials = (obj: THREE.Object3D) => {
      URL.revokeObjectURL(url);

      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          // Assegura que os materiais fiquem visíveis e não fiquem brancos/transparentes
          if (mesh.material) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((mat) => {
              mat.side = THREE.DoubleSide;
              mat.needsUpdate = true;
            });
          }
        }
      });

      this.scene.add(obj);
      callback(obj);
    };

    if (ext === 'fbx') {
      const loader = new FBXLoader();
      loader.load(url, (fbx) => processPropMaterials(fbx));
    } else if (ext === 'glb' || ext === 'gltf') {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => processPropMaterials(gltf.scene));
    }
  }

  // Fixar Objeto no Osso do Personagem
  public attachToBone(propObj: THREE.Object3D, boneName: string): boolean {
    let targetBone: THREE.Bone | null = null;

    if (this.characterModel) {
      this.characterModel.traverse((child) => {
        if ((child as THREE.Bone).isBone && child.name === boneName) {
          targetBone = child as THREE.Bone;
        }
      });
    }

    if (targetBone) {
      (targetBone as THREE.Bone).add(propObj);
      return true;
    }
    return false;
  }

  // Desfixar Objeto e voltar para a cena principal
  public detachFromBone(propObj: THREE.Object3D) {
    this.scene.add(propObj);
  }

  // Controles de Animação
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

  // Controles de Visualização
  public setBrightness(val: number) {
    this.dirLight.intensity = val;
    this.hemiLight.intensity = val;
  }

  public setCharacterScale(scalePercent: number) {
    if (this.characterModel) {
      const s = scalePercent / 100;
      this.characterModel.scale.set(s, s, s);
    }
  }

  // EXPORTAR GLB COMPLETO (Com Animações e Texturas Preservadas)
  public exportGLB() {
    if (!this.characterGroup) return;

    const exporter = new GLTFExporter();

    // Reúne todas as animações vinculadas
    const animsToExport = this.animations.length > 0 ? this.animations : (this.characterGroup.animations || []);

    exporter.parse(
      this.characterGroup,
      (gltf) => {
        const output = gltf instanceof ArrayBuffer ? gltf : JSON.stringify(gltf);
        const blob = new Blob([output], { type: 'application/octet-stream' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'Personagem_Animado.glb';
        link.click();
      },
      (error) => {
        console.error('Erro ao exportar GLB:', error);
      },
      {
        binary: true,             // Exporta em arquivo compacto .GLB
        animations: animsToExport, // Inclui as faixas de animação no arquivo
        embedImages: true          // Garante que as imagens das texturas sejam salvas dentro do GLB
      }
    );
  }

  public dispose() {
    if (this.reqId) cancelAnimationFrame(this.reqId);
    this.renderer.dispose();
  }
}
