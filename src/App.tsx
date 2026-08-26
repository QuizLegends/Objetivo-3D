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
  const [isAttached, setIsAttached] = useState<boolean>(false);
  const [isPropSelected, setIsPropSelected] = useState<boolean>(false);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
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
        setIsPropSelected(true);
        setIsAttached(false);
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
      threeManagerRef.current.attachToBone(selectedBone);
      setIsAttached(true);
      setIsPropSelected(true);
    }
  };

  const handleDetachProp = () => {
    if (threeManagerRef.current) {
      threeManagerRef.current.detachFromBone();
      setIsAttached(false);
    }
  };

  const handleToggleSelectProp = () => {
    if (!threeManagerRef.current) return;
    if (isPropSelected) {
      threeManagerRef.current.deselectProp();
      setIsPropSelected(false);
    } else {
      threeManagerRef.current.selectProp();
      setIsPropSelected(true);
    }
  };

  const handleChangeTransformMode = (mode: 'translate' | 'rotate' | 'scale') => {
    setTransformMode(mode);
    threeManagerRef.current?.setTransformMode(mode);
  };

  const handleMoveX = (delta: number) => threeManagerRef.current?.movePropX(delta);
  const handleMoveY = (delta: number) => threeManagerRef.current?.movePropY(delta);
  const handleMoveZ = (delta: number) => threeManagerRef.current?.movePropZ(delta);
  const handleScaleProp = (factor: number) => threeManagerRef.current?.scaleProp(factor);
  const handleRotateProp = (axis: 'x' | 'y' | 'z', deg: number) => threeManagerRef.current?.rotateProp(axis, deg);

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
      <div ref={containerRef} style={styles.canvasContainer} />

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

        {/* Seleção do Osso e Botão de Fixar */}
        {currentProp && bones.length > 0 && (
          <div style={styles.formGroup}>
            <h4 style={styles.subtitle}>Vincular ao Esqueleto</h4>
            <label style={styles.label}>Escolha a parte do corpo (Osso):</label>
            <select
              value={selectedBone}
              onChange={(e) => setSelectedBone(e.target.value)}
              style={styles.select}
            >
              <option value="">Selecione o osso (ex: RightHand)...</option>
              {bones.map((b) => (
                <option key={b.uuid} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
            {!isAttached ? (
              <button
                type="button"
                onClick={handleAttachProp}
                disabled={!selectedBone}
                style={{
                  ...styles.btn,
                  backgroundColor: selectedBone ? '#10b981' : '#475569',
                  color: '#fff',
                }}
              >
                🔗 Fixar Posição Atual no Osso
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDetachProp}
                style={{ ...styles.btn, backgroundColor: '#ef4444', color: '#fff' }}
              >
                🔓 Desfixar do Osso
              </button>
            )}
          </div>
        )}

        {/* Controles por Toque na Tela */}
        {currentProp && (
          <div style={styles.formGroup}>
            <h4 style={styles.subtitle}>Controle por Toque na Tela</h4>
            <button
              type="button"
              onClick={handleToggleSelectProp}
              style={{
                ...styles.btn,
                backgroundColor: isPropSelected ? '#e11d48' : '#10b981',
                color: '#fff',
                marginBottom: '8px',
              }}
            >
              {isPropSelected ? '✖️ Desselecionar Objeto' : '✋ Selecionar Objeto (Toque)'}
            </button>

            {isPropSelected && (
              <div>
                <label style={styles.subLabel}>Modo de Arraste por Toque:</label>
                <div style={styles.btnRow}>
                  <button
                    type="button"
                    onClick={() => handleChangeTransformMode('translate')}
                    style={{
                      ...styles.btn,
                      ...styles.btnMode,
                      backgroundColor: transformMode === 'translate' ? '#0284c7' : '#1e293b',
                    }}
                  >
                    ✋ Mover
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeTransformMode('rotate')}
                    style={{
                      ...styles.btn,
                      ...styles.btnMode,
                      backgroundColor: transformMode === 'rotate' ? '#4f46e5' : '#1e293b',
                    }}
                  >
                    🔄 Rotação
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeTransformMode('scale')}
                    style={{
                      ...styles.btn,
                      ...styles.btnMode,
                      backgroundColor: transformMode === 'scale' ? '#d97706' : '#1e293b',
                    }}
                  >
                    🔍 Escala
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ajustes Finos (Botões) */}
        {currentProp && (
          <div style={styles.formGroup}>
            <h4 style={styles.subtitle}>Ajustes Finos (Botões)</h4>
            
            <label style={styles.subLabel}>Posição:</label>
            <div style={styles.btnRow}>
              <button type="button" onClick={() => handleMoveY(0.05)} style={{ ...styles.btn, ...styles.btnMove }}>⬆️ Cima</button>
              <button type="button" onClick={() => handleMoveY(-0.05)} style={{ ...styles.btn, ...styles.btnMove }}>⬇️ Baixo</button>
            </div>
            <div style={styles.btnRow}>
              <button type="button" onClick={() => handleMoveX(-0.05)} style={{ ...styles.btn, ...styles.btnMove }}>⬅️ Esquerda</button>
              <button type="button" onClick={() => handleMoveX(0.05)} style={{ ...styles.btn, ...styles.btnMove }}>➡️ Direita</button>
            </div>
            <div style={styles.btnRow}>
              <button type="button" onClick={() => handleMoveZ(0.05)} style={{ ...styles.btn, ...styles.btnMove }}>↗️ Frente</button>
              <button type="button" onClick={() => handleMoveZ(-0.05)} style={{ ...styles.btn, ...styles.btnMove }}>↙️ Trás</button>
            </div>

            <label style={styles.subLabel}>Tamanho (Escala):</label>
            <div style={styles.btnRow}>
              <button type="button" onClick={() => handleScaleProp(1.1)} style={{ ...styles.btn, ...styles.btnScale }}>🔍+ Aumentar</button>
              <button type="button" onClick={() => handleScaleProp(0.9)} style={{ ...styles.btn, ...styles.btnScale }}>🔍- Diminuir</button>
            </div>

            <label style={styles.subLabel}>Rotação:</label>
            <div style={styles.btnRow}>
              <button type="button" onClick={() => handleRotateProp('y', 15)} style={{ ...styles.btn, ...styles.btnRotate }}>🔄 Giro Y (+15°)</button>
              <button type="button" onClick={() => handleRotateProp('y', -15)} style={{ ...styles.btn, ...styles.btnRotate }}>🔄 Giro Y (-15°)</button>
            </div>
            <div style={styles.btnRow}>
              <button type="button" onClick={() => handleRotateProp('x', 15)} style={{ ...styles.btn, ...styles.btnRotate }}>↩️ Inclin X (+15°)</button>
              <button type="button" onClick={() => handleRotateProp('z', 15)} style={{ ...styles.btn, ...styles.btnRotate }}>↪️ Inclin Z (+15°)</button>
            </div>
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
    marginTop: '12px',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#38bdf8',
  },
  subLabel: {
    display: 'block',
    fontSize: '12px',
    marginTop: '6px',
    marginBottom: '4px',
    color: '#cbd5e1',
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
  btnRow: {
    display: 'flex',
    gap: '6px',
    marginBottom: '4px',
  },
  animList: {
    maxHeight: '150px',
    overflowY: 'auto',
    marginBottom: '6px',
  },
  btn: {
    width: '100%',
    padding: '8px',
    border: 'none',
    borderRadius: '4px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '12px',
    boxSizing: 'border-box',
  },
  btnMode: {
    border: '1px solid #334155',
    color: '#fff',
    flex: 1,
  },
  btnMove: {
    backgroundColor: '#0284c7',
    color: '#fff',
    flex: 1,
  },
  btnScale: {
    backgroundColor: '#d97706',
    color: '#fff',
    flex: 1,
  },
  btnRotate: {
    backgroundColor: '#4f46e5',
    color: '#fff',
    flex: 1,
  },
  btnAnim: {
    backgroundColor: '#3b82f6',
    color: '#fff',
    marginBottom: '6px',
  },
  btnStop: {
    backgroundColor: '#ef4444',
    color: '#fff',
    padding: '10px',
  },
  btnExport: {
    backgroundColor: '#8b5cf6',
    color: '#fff',
    padding: '12px',
    marginTop: '12px',
  },
};

export default App;
