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
    
    // Configura o espaço de cores correto para evitar modelos pretos e sombras estouradas
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1, 0);

    // Iluminação Geral do Cenário
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

  // Correção Avançada de Materiais, Normais e Texturas
  private sanitizeMaterials(model: THREE.Object3D) {
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Recalcula as normais da geometria para corrigir iluminação quebrada/invertida
        if (mesh.geometry) {
          mesh.geometry.computeVertexNormals();
        }

        // Se o modelo veio sem material
        if (!mesh.material) {
          mesh.material = new THREE.MeshStandardMaterial({
            color: 0x909090,
            roughness: 0.5,
            metalness: 0.1,
            side: THREE.DoubleSide
          });
        } else {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

          const updatedMaterials = materials.map((mat) => {
            mat.side = THREE.DoubleSide;
            mat.transparent = false;
            mat.opacity = 1.0;

            const standardMat = mat as THREE.MeshStandardMaterial;

            // Se o modelo não tiver imagem de textura associada, aplica uma cor neutra visível
            if (!standardMat.map) {
              return new THREE.MeshStandardMaterial({
                color: 0xa0a0a0,
                roughness: 0.4,
                metalness: 0.1,
                side: THREE.DoubleSide
              });
            } else {
              // Se tiver textura, garante que o mapa de cores use sRGB
              standardMat.map.colorSpace = THREE.SRGBColorSpace;
              standardMat.map.needsUpdate = true;
            }

            mat.needsUpdate = true;
            return mat;
          });

          mesh.material = Array.isArray(mesh.material) ? updatedMaterials : updatedMaterials[0];
        }
      }
    });
  }

  // Carregar Personagem (FBX / GLB)
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

      this.sanitizeMaterials(model);

      this.bones = [];
      model.traverse((child) => {
        if ((child as THREE.Bone).isBone) {
          this.bones.push(child as THREE.Bone);
        }
      });

      this.mixer = new THREE.AnimationMixer(model);
      this.animations = anims;

      // Vincula as animações na raiz do grupo para exportação do GLB
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

  // Carregar Objeto / Arma
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

  // Anexar Objeto ao Osso do Personagem
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

  // Remover Objeto do Osso
  public detachFromBone(propObj: THREE.Object3D) {
    this.scene.add(propObj);
  }

  // Executar Animação
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

  // Controle de Brilho das Luzes
  public setBrightness(val: number) {
    this.dirLight.intensity = val;
    this.fillLight.intensity = val * 0.6;
    this.hemiLight.intensity = val;
    this.ambientLight.intensity = val;
  }

  // Escala do Personagem
  public setCharacterScale(scalePercent: number) {
    if (this.characterModel) {
      const s = scalePercent / 100;
      this.characterModel.scale.set(s, s, s);
    }
  }

  // Exportar Personagem + Prop Anexado para GLB
  public exportGLB() {
    if (!this.characterGroup) return;

    const exporter = new GLTFExporter();
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
        binary: true,
        animations: animsToExport,
        embedImages: true
      }
    );
  }

  public dispose() {
    if (this.reqId) cancelAnimationFrame(this.reqId);
    this.renderer.dispose();
  }
}
