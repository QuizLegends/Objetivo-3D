import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';

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
  private animations: THREE.AnimationClip[] = [];
  
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

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // 4. Controles
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.animate();
  }

  // Loop de Renderização
  private animate = () => {
    this.reqId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();

    if (this.mixer) {
      this.mixer.update(delta);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // Centralizar Câmera no Objeto/Personagem
  private centerCameraOn(object: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 2.0; // Recuo seguro de visualização

    this.camera.position.set(center.x, center.y + (maxDim * 0.2), center.z + cameraZ);
    this.camera.lookAt(center);
    this.controls.target.copy(center);
    this.controls.update();
  }

  // Carregar Personagem (FBX ou GLB)
  public loadCharacter(file: File, callback: (bones: THREE.Bone[], anims: THREE.AnimationClip[]) => void) {
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();

    const onLoad = (obj: THREE.Object3D, animations: THREE.AnimationClip[]) => {
      if (this.character) this.scene.remove(this.character);

      this.character = obj;
      this.animations = animations || [];
      
      this.character.position.set(0, 0, 0);
      this.scene.add(this.character);

      // Mixer de Animação
      this.mixer = new THREE.AnimationMixer(this.character);

      // Coleta ossos
      const bones: THREE.Bone[] = [];
      this.character.traverse((child) => {
        if ((child as THREE.Bone).isBone) {
          bones.push(child as THREE.Bone);
        }
      });

      // Enquadra a câmera automaticamente no personagem recém-carregado
      this.centerCameraOn(this.character);

      URL.revokeObjectURL(url);
      callback(bones, this.animations);
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
      this.attachedProp.position.set(0, 0, 0);
      this.attachedProp.rotation.set(0, 0, 0);

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
      (targetBone as THREE.Bone).add(prop);
      prop.position.set(0, 0, 0);
      prop.rotation.set(0, 0, 0);
      
      // Centraliza a câmera no conjunto (Personagem + Objeto)
      this.centerCameraOn(this.character);
    }
  }

  // Aplicar Textura Customizada ao Objeto (Garantindo compatibilidade de exportação)
  public applyPropTexture(file: File) {
    if (!this.attachedProp) return;

    const url = URL.createObjectURL(file);
    const loader = new THREE.TextureLoader();
    loader.load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false; // Ajuste padrão para mapeamento UV de modelos 3D modernos

      this.attachedProp?.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          
          // Cria um novo MeshStandardMaterial para garantir compatibilidade com o GLTFExporter
          const newMat = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.5,
            metalness: 0.1
          });

          mesh.material = newMat;
          mesh.material.needsUpdate = true;
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

  // --- ANIMAÇÕES E EXPORTAÇÃO CORRIGIDA ---

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

  // Exportar GLB com Animações e Materiais Preservados
  public exportGLB() {
    if (!this.character) return;

    const exporter = new GLTFExporter();
    
    // Configurações essenciais para incluir animações e texturas no arquivo final
    const options = {
      binary: true,
      animations: this.animations, // Inclui a lista de animações no GLB baixado
      embedImages: true             // Garante a inclusão de imagens/texturas aplicadas
    };

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
      options
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
