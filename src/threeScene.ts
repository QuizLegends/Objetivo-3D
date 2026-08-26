import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/loaders/GLTFExporter.js';

export class ThreeManager {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;

  private mixer: THREE.AnimationMixer | null = null;
  private clock: THREE.Clock = new THREE.Clock();
  
  private character: THREE.Object3D | null = null;
  private attachedProp: THREE.Object3D | null = null;
  private propTexture: THREE.Texture | null = null;
  private dirLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;

  private reqId: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Cena e Iluminação
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#071220');

    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    this.dirLight.position.set(5, 10, 7);
    this.scene.add(this.dirLight);

    // 2. Câmera
    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.5, 3);

    // 3. Renderer com otimização de performance
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // 4. Controles
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.animate();
  }

  // Loop de Animação Otimizado
  private animate = () => {
    this.reqId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();

    if (this.mixer) {
      this.mixer.update(delta);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // Carregar Personagem (FBX ou GLB)
  public loadCharacter(file: File, callback: (bones: THREE.Bone[], anims: THREE.AnimationClip[]) => void) {
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();

    const onLoad = (obj: THREE.Object3D, animations: THREE.AnimationClip[]) => {
      if (this.character) this.scene.remove(this.character);

      this.character = obj;
      
      // Normaliza tamanho do personagem
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const targetScale = 2 / maxDim; // Redimensiona para ter ~2m de altura
        obj.scale.setScalar(targetScale);
      }

      obj.position.set(0, 0, 0);
      this.scene.add(obj);

      // Prepara Mixer de Animação
      this.mixer = new THREE.AnimationMixer(obj);

      // Coleta ossos
      const bones: THREE.Bone[] = [];
      obj.traverse((child) => {
        if ((child as THREE.Bone).isBone) {
          bones.push(child as THREE.Bone);
        }
      });

      // Enquadra Câmera
      this.controls.target.set(0, 1, 0);
      this.camera.position.set(0, 1.5, 3);
      this.controls.update();

      URL.revokeObjectURL(url);
      callback(bones, animations);
    };

    if (ext === 'fbx') {
      const loader = new FBXLoader();
      loader.load(url, (fbx) => onLoad(fbx, fbx.animations || []));
    } else if (ext === 'glb' || ext === 'gltf') {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => onLoad(gltf.scene, gltf.animations || []));
    }
  }

  // Carregar Objeto / Arma
  public loadProp(file: File, callback: (prop: THREE.Object3D) => void) {
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();

    const onLoad = (obj: THREE.Object3D) => {
      if (this.attachedProp) {
        this.attachedProp.removeFromParent();
      }

      this.attachedProp = obj;

      // Normaliza escala inicial do objeto para evitar estouro de tela
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const targetScale = 0.5 / maxDim; // Escala padrão inicial pequena
        obj.scale.setScalar(targetScale);
      }

      // Reseta posição e rotação relativas
      obj.position.set(0, 0, 0);
      obj.rotation.set(0, 0, 0);

      URL.revokeObjectURL(url);
      callback(obj);
    };

    if (ext === 'fbx') {
      const loader = new FBXLoader();
      loader.load(url, onLoad);
    } else if (ext === 'glb' || ext === 'gltf') {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => onLoad(gltf.scene));
    }
  }

  // Anexar o Objeto ao Osso Selecionado
  public attachToBone(prop: THREE.Object3D, boneName: string) {
    if (!this.character) return;

    let targetBone: THREE.Bone | null = null;
    this.character.traverse((child) => {
      if ((child as THREE.Bone).isBone && child.name === boneName) {
        targetBone = child as THREE.Bone;
      }
    });

    if (targetBone) {
      // Remove do pai anterior e anexa ao novo osso com matriz zerada
      prop.removeFromParent();
      prop.position.set(0, 0, 0);
      prop.rotation.set(0, 0, 0);
      (targetBone as THREE.Bone).add(prop);
    }
  }

  // Aplicar Textura Customizada ao Objeto
  public applyPropTexture(file: File) {
    if (!this.attachedProp) return;

    const url = URL.createObjectURL(file);
    const loader = new THREE.TextureLoader();
    loader.load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      this.propTexture = texture;

      this.attachedProp?.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => {
              (mat as THREE.MeshStandardMaterial).map = texture;
              mat.needsUpdate = true;
            });
          } else if (mesh.material) {
            (mesh.material as THREE.MeshStandardMaterial).map = texture;
            mesh.material.needsUpdate = true;
          }
        }
      });
      URL.revokeObjectURL(url);
    });
  }

  // --- MÉTODOS DE MANIPULAÇÃO DO OBJETO ANEXADO ---

  public moveAttachedProp(deltaX: number, deltaY: number, deltaZ: number) {
    if (this.attachedProp) {
      this.attachedProp.position.x += deltaX;
      this.attachedProp.position.y += deltaY;
      this.attachedProp.position.z += deltaZ;
    }
  }

  public setAttachedPropScale(scale: number) {
    if (this.attachedProp) {
      this.attachedProp.scale.setScalar(scale);
    }
  }

  public rotateAttachedProp(degrees: number) {
    if (this.attachedProp) {
      const radians = (degrees * Math.PI) / 180;
      this.attachedProp.rotation.y = radians;
    }
  }

  // --- DEMAIS MÉTODOS DO GERENCIADOR ---

  public playAnimation(anim: THREE.AnimationClip) {
    if (this.mixer) {
      this.mixer.stopAllAction();
      const action = this.mixer.clipAction(anim);
      action.play();
    }
  }

  public stopAnimation() {
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
  }

  public setBrightness(val: number) {
    this.ambientLight.intensity = val;
    this.dirLight.intensity = val * 1.3;
  }

  public setCharacterScale(percent: number) {
    if (this.character) {
      const factor = percent / 100;
      this.character.scale.setScalar(factor);
    }
  }

  public exportGLB() {
    if (!this.character) return;
    const exporter = new GLTFExporter();
    exporter.parse(
      this.character,
      (gltf) => {
        const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'modelo_animado.glb';
        link.click();
      },
      (error) => {
        console.error('Erro ao exportar GLB:', error);
      },
      { binary: true }
    );
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public dispose() {
    if (this.reqId) cancelAnimationFrame(this.reqId);
    this.renderer.dispose();
  }
}
