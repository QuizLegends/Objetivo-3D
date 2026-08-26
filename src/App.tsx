import React, { useEffect, useRef, useState } from 'react';
import { ThreeManager } from './threeScene';
import * as THREE from 'three';

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const threeManagerRef = useRef<ThreeManager | null>(null);

  const [bones, setBones] = useState<THREE.Bone[]>([]);
  const [animations, setAnimations] = useState<THREE.AnimationClip[]>([]);
  const [selectedBone, setSelectedBone] = useState<string>('');
  const [currentProp, setCurrentProp] = useState<THREE.Object3D | null>(null);
  const [brightness, setBrightness] = useState<number>(1.5);
  const [scale, setScale] = useState<number>(100);

  useEffect(() => {
    if (containerRef.current && !threeManagerRef.current) {
      threeManagerRef.current = new ThreeManager(containerRef.current);

      const handleResize = () => {
        if (containerRef.current && threeManagerRef.current) {
          threeManagerRef.current.resize(
            containerRef.current.clientWidth,
            containerRef.current.clientHeight
          );
        }
      };

      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        threeManagerRef.current?.dispose();
      };
    }
  }, []);

  const handleCharacterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && threeManagerRef.current) {
      threeManagerRef.current.loadCharacter(file, (loadedBones, loadedAnims) => {
        setBones(loadedBones);
        setAnimations(loadedAnims);
      });
    }
  };

  const handlePropUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && threeManagerRef.current) {
      threeManagerRef.current.loadProp(file, (propObj) => {
        setCurrentProp(propObj);
      });
    }
  };

  const handlePropTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && threeManagerRef.current) {
      threeManagerRef.current.applyPropTexture(file);
    }
  };

  const handleAttachProp = () => {
    if (threeManagerRef.current && currentProp && selectedBone) {
      threeManagerRef.current.attachToBone(currentProp, selectedBone);
    }
  };

  const handlePlayAnim = (anim: THREE.AnimationClip) => {
    threeManagerRef.current?.playAnimation(anim);
  };

  const handleStopAnim = () => {
    threeManagerRef.current?.stopAnimation();
  };

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setBrightness(val);
    threeManagerRef.current?.setBrightness(val);
  };

  const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setScale(val);
    threeManagerRef.current?.setCharacterScale(val);
  };

  const handleExportGLB = () => {
    threeManagerRef.current?.exportGLB();
  };

  return (
    <div style={styles.appContainer}>
      {/* Container Principal do Viewport 3D */}
      <div ref={containerRef} style={styles.canvasContainer} />

      {/* Painel Lateral Estilizado */}
      <div style={styles.sidebar}>
        <h3 style={styles.title}>Controles 3D</h3>

        <div style={styles.formGroup}>
          <label style={styles.label}>Personagem (FBX/GLB):</label>
          <input type="file" accept=".fbx,.glb,.gltf" onChange={handleCharacterUpload} style={styles.input} />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Objeto / Arma (FBX/GLB):</label>
          <input type="file" accept=".fbx,.glb,.gltf" onChange={handlePropUpload} style={styles.input} />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Textura do Objeto (PNG/JPG):</label>
          <input type="file" accept="image/png, image/jpeg" onChange={handlePropTextureUpload} style={styles.input} />
        </div>

        {bones.length > 0 && (
          <div style={styles.formGroup}>
            <label style={styles.label}>Selecione o Osso:</label>
            <select
              value={selectedBone}
              onChange={(e) => setSelectedBone(e.target.value)}
              style={styles.select}
            >
              <option value="">Selecione...</option>
              {bones.map((b) => (
                <option key={b.uuid} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleAttachProp} style={{ ...styles.btn, ...styles.btnAttach }}>
              Anexar Objeto ao Osso
            </button>
          </div>
        )}

        {animations.length > 0 && (
          <div style={styles.formGroup}>
            <h4 style={styles.subtitle}>Animações</h4>
            <div style={styles.animList}>
              {animations.map((anim, idx) => (
                <button
                  type="button"
                  key={anim.uuid || idx}
                  onClick={() => handlePlayAnim(anim)}
                  style={{ ...styles.btn, ...styles.btnAnim }}
                >
                  ▶️ {anim.name || `Animação ${idx + 1}`}
                </button>
              ))}
            </div>
            <button type="button" onClick={handleStopAnim} style={{ ...styles.btn, ...styles.btnStop }}>
              ⏹️ Parar Animação
            </button>
          </div>
        )}

        <div style={styles.formGroup}>
          <label style={styles.label}>
            Brilho: <span style={styles.spanVal}>{brightness}</span>
          </label>
          <input
            type="range"
            min="0.2"
            max="4"
            step="0.1"
            value={brightness}
            onChange={handleBrightnessChange}
            style={styles.range}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            Escala do Personagem: <span style={styles.spanVal}>{scale}%</span>
          </label>
          <input
            type="range"
            min="10"
            max="300"
            step="5"
            value={scale}
            onChange={handleScaleChange}
            style={styles.range}
          />
        </div>

        <button type="button" onClick={handleExportGLB} style={{ ...styles.btn, ...styles.btnExport }}>
          📥 Exportar GLB Animado
        </button>
      </div>
    </div>
  );
};

// Estilização idêntica ao HTML original fornecido
const styles: { [key: string]: React.CSSProperties } = {
  appContainer: {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    backgroundColor: '#071220',
    color: '#ffffff',
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden',
  },
  canvasContainer: {
    flex: 1,
    height: '100%',
  },
  sidebar: {
    width: '320px',
    height: '100%',
    backgroundColor: '#0d1f38',
    padding: '16px',
    overflowY: 'auto',
    borderLeft: '1px solid #1e293b',
    boxSizing: 'border-box',
  },
  title: {
    marginBottom: '12px',
    fontSize: '18px',
    fontWeight: 'bold',
  },
  subtitle: {
    marginBottom: '12px',
    fontSize: '15px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    marginBottom: '6px',
    color: '#94a3b8',
  },
  spanVal: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    padding: '8px',
    backgroundColor: '#1e293b',
    color: '#fff',
    border: '1px solid #334155',
    borderRadius: '4px',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '8px',
    backgroundColor: '#1e293b',
    color: '#fff',
    border: '1px solid #334155',
    borderRadius: '4px',
    marginBottom: '8px',
    boxSizing: 'border-box',
  },
  range: {
    width: '100%',
    accentColor: '#38bdf8',
  },
  animList: {
    maxHeight: '150px',
    overflowY: 'auto',
    marginBottom: '6px',
  },
  btn: {
    width: '100%',
    padding: '10px',
    marginTop: '4px',
    border: 'none',
    borderRadius: '4px',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  btnAttach: {
    backgroundColor: '#10b981',
    color: '#fff',
  },
  btnAnim: {
    backgroundColor: '#3b82f6',
    color: '#fff',
    marginBottom: '6px',
  },
  btnStop: {
    backgroundColor: '#ef4444',
    color: '#fff',
  },
  btnExport: {
    backgroundColor: '#8b5cf6',
    color: '#fff',
    padding: '12px',
    marginTop: '12px',
  },
};

export default App;
