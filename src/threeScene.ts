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
  private fillLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private ambientLight: THREE.AmbientLight;

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
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1, 0);

    // Iluminação
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.8);
    this.hemiLight.position.set(0, 20, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.dirLight.position.set(5, 10, 7);
    this.dirLight.castShadow = true;
    this.scene.add(this.dirLight);

    this.fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.fillLight.position.set(-5, 5, -5);
    this.scene.add(this.fillLight);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(this.ambientLight);

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

  // Tratamento rigoroso de Geometria e Materiais (Resolve erro de Tangente e Cores)
  private sanitizeMaterials(model: THREE.Object3D) {
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (mesh.geometry) {
          mesh.geometry.computeVertexNormals();

          // Resolve o aviso MESH_PRIMITIVE_GENERATED_TANGENT_SPACE
          // Gera tangentes se o modelo tiver UVs e material com normalMap
          if (mesh.geometry.attributes.uv && !mesh.geometry.attributes.tangent) {
            try {
              mesh.geometry.computeTangents();
            } catch (e) {
              // Se falhar o cálculo de tangente, removemos o normalMap problemático do material
              if (mesh.material) {
                const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                mats.forEach((m) => {
                  if ((m as THREE.MeshStandardMaterial).normalMap) {
                    (m as THREE.MeshStandardMaterial).normalMap = null;
                  }
                });
              }
            }
          }
        }

        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

          materials.forEach((mat) => {
            mat.side = THREE.DoubleSide;

            if (mat.transparent && mat.opacity >= 0.99) {
              mat.transparent = false;
              mat.depthWrite = true;
            }

            const standardMat = mat as THREE.MeshStandardMaterial;

            // Garante o mapa de cores em sRGB
            if (standardMat.map) {
              standardMat.map.colorSpace = THREE.SRGBColorSpace;
              standardMat.map.needsUpdate = true;
            } else if (standardMat.color) {
              // Se não tiver textura e a cor for preta por erro, ajusta para tom padrão visível
              if (standardMat.color.r === 0 && standardMat.color.g === 0 && standardMat.color.b === 0) {
                standardMat.color.setHex(0xaaaaaa);
              }
            }

            if ('roughness' in mat) standardMat.roughness = 0.6;
            if ('metalness' in mat) standardMat.metalness = 0.1;

            mat.needsUpdate = true;
          });
        }
      }
    });
  }

  // Carregar Personagem
  public loadCharacter(file: File, callback: (bones: THREE.Bone[], anims: THREE.AnimationClip[]) => void) {
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (this.characterGroup) {
      this.scene.remove(this.characterGroup);
    }

    this.characterGroup = new THREE.Group();
    this.characterGroup.name = "CharacterRoot";
    this.scene.add(this.characterGroup);

    const onModelLoaded = (model: THREE.Object3D, anims: THREE.AnimationClip[]) => {
      URL.revokeObjectURL(url);
      this.characterModel = model;
      this.characterGroup!.add(model);

      this.sanitizeMaterials(model);

      this.bones = [];
      model.traverse((child) => {
        if ((child as THREE.Bone).isBone) {
          this.bones.push(child as THREE.Bone);
        }
      });

      this.mixer = new THREE.AnimationMixer(model);
      this.animations = anims;

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

  // Carregar Objeto
  public loadProp(file: File, callback: (obj: THREE.Object3D) => void) {
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();

    const processProp = (obj: THREE.Object3D) => {
      URL.revokeObjectURL(url);
      this.sanitizeMaterials(obj);
      this.scene.add(obj);
      callback(obj);
    };

    if (ext === 'fbx') {
      const loader = new FBXLoader();
      loader.load(url, (fbx) => processProp(fbx));
    } else if (ext === 'glb' || ext === 'gltf') {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => processProp(gltf.scene));
    }
  }

  // Anexar Objeto ao Osso
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

  // Desfixar Objeto
  public detachFromBone(propObj: THREE.Object3D) {
    this.scene.add(propObj);
  }

  // Animação
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

  // Brilho
  public setBrightness(val: number) {
    this.dirLight.intensity = val;
    this.fillLight.intensity = val * 0.6;
    this.hemiLight.intensity = val;
    this.ambientLight.intensity = val;
  }

  // Escala
  public setCharacterScale(scalePercent: number) {
    if (this.characterModel) {
      const s = scalePercent / 100;
      this.characterModel.scale.set(s, s, s);
    }
  }

  // Exportar GLB Válido (Corrige SKIN_SKELETON_INVALID e preserva materiais/animações)
  public exportGLB() {
    if (!this.characterGroup) return;

    const exporter = new GLTFExporter();
    
    // Exporta diretamente a partir do characterModel para evitar wrappers que quebram o esqueleto
    const exportTarget = this.characterModel ? this.characterModel : this.characterGroup;

    exporter.parse(
      exportTarget,
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
        binary: true,
        animations: this.animations,
        embedImages: true,
        onlyVisible: true
      }
    );
  }

  public dispose() {
    if (this.reqId) cancelAnimationFrame(this.reqId);
    this.renderer.dispose();
  }
}
