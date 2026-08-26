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

  // Estados para transformação do Objeto/Arma (Sem nomes X, Y, Z)
  const [propScale, setPropScale] = useState<number>(1);
  const [propRotY, setPropRotY] = useState<number>(0);
  const [touchMode, setTouchMode] = useState<'camera' | 'moveProp'>('camera');

  useEffect(() => {
    let isMounted = true;

    if (containerRef.current && !threeManagerRef.current) {
      const manager = new ThreeManager(containerRef.current);
      threeManagerRef.current = manager;

      manager.resize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );

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
        isMounted = false;
        window.removeEventListener('resize', handleResize);
        setTimeout(() => {
          if (!isMounted && threeManagerRef.current) {
            threeManagerRef.current.dispose();
            threeManagerRef.current = null;
          }
        }, 0);
      };
    }
  }, []);

  // --- LÓGICA DE GESTOS COM O DEDO NA TELA (TOUCH) ---
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (touchMode === 'moveProp' && e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchMode === 'moveProp' && touchStartRef.current && e.touches.length === 1 && threeManagerRef.current) {
      const deltaX = (e.touches[0].clientX - touchStartRef.current.x) * 0.05;
      const deltaY = (e.touches[0].clientY - touchStartRef.current.y) * 0.05;

      // Arrastar para os lados (Esquerda/Direita) e para cima/baixo
      threeManagerRef.current.moveAttachedProp(deltaX, -deltaY, 0);

      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  // --- HANDLERS EXISTENTES ---
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

  // --- NOVOS HANDLERS DE TRANSFORMAÇÃO (SEM SIGLAS TÉCNICAS) ---
  const handleMovePropDirection = (dir: 'up' | 'down' | 'left' | 'right' | 'front' | 'back') => {
    if (!threeManagerRef.current) return;
    const step = 0.5;
    switch (dir) {
      case 'up': threeManagerRef.current.moveAttachedProp(0, step, 0); break;
      case 'down': threeManagerRef.current.moveAttachedProp(0, -step, 0); break;
      case 'left': threeManagerRef.current.moveAttachedProp(-step, 0, 0); break;
      case 'right': threeManagerRef.current.moveAttachedProp(step, 0, 0); break;
      case 'front': threeManagerRef.current.moveAttachedProp(0, 0, step); break;
      case 'back': threeManagerRef.current.moveAttachedProp(0, 0, -step); break;
    }
  };

  const handlePropScaleChange = (delta: number) => {
    const newScale = Math.max(0.1, propScale + delta);
    setPropScale(newScale);
    threeManagerRef.current?.setAttachedPropScale(newScale);
  };

  const handlePropRotate360 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPropRotY(val);
    threeManagerRef.current?.rotateAttachedProp(val);
  };

  return (
    <div style={styles.appContainer}>
      {/* Container Principal do Viewport 3D com Suporte a Gestos no Dedo */}
      <div 
        ref={containerRef} 
        style={styles.canvasContainer}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Botão Flutuante para alternar entre Mover Objeto ou Girar Câmera com o Dedo */}
        {currentProp && selectedBone && (
          <div style={styles.floatingTouchControl}>
            <button
              type="button"
              onClick={() => setTouchMode(touchMode === 'camera' ? 'moveProp' : 'camera')}
              style={{
                ...styles.btn,
                backgroundColor: touchMode === 'moveProp' ? '#f59e0b' : '#0284c7',
              }}
            >
              {touchMode === 'moveProp' ? '👉 Modo: Mover Objeto (Dedo)' : '🔄 Modo: Girar Câmera'}
            </button>
          </div>
        )}
      </div>

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

        {/* AJUSTES FINOS DO OBJETO ANEXADO (EM PORTUGUÊS CLARO) */}
        {currentProp && selectedBone && (
          <div style={styles.sectionBox}>
            <h4 style={styles.subtitle}>Ajustar Posição do Objeto</h4>
            
            <div style={styles.gridButtons}>
              <button type="button" onClick={() => handleMovePropDirection('up')} style={styles.btnDirection}>⬆️ Para Cima</button>
              <button type="button" onClick={() => handleMovePropDirection('down')} style={styles.btnDirection}>⬇️ Para Baixo</button>
              <button type="button" onClick={() => handleMovePropDirection('left')} style={styles.btnDirection}>⬅️ Para Esquerda</button>
              <button type="button" onClick={() => handleMovePropDirection('right')} style={styles.btnDirection}>➡️ Para Direita</button>
              <button type="button" onClick={() => handleMovePropDirection('front')} style={styles.btnDirection}>↗️ Para Frente</button>
              <button type="button" onClick={() => handleMovePropDirection('back')} style={styles.btnDirection}>↙️ Para Trás</button>
            </div>

            <div style={{ marginTop: '10px' }}>
              <label style={styles.label}>Tamanho do Objeto:</label>
              <div style={styles.flexRow}>
                <button type="button" onClick={() => handlePropScaleChange(-0.1)} style={styles.btnAction}>🔍 Diminuir</button>
                <button type="button" onClick={() => handlePropScaleChange(0.1)} style={styles.btnAction}>🔍 Aumentar</button>
              </div>
            </div>

            <div style={{ marginTop: '10px' }}>
              <label style={styles.label}>Girar 360° em volta do osso:</label>
              <input
                type="range"
                min="0"
                max="360"
                value={propRotY}
                onChange={handlePropRotate360}
                style={styles.range}
              />
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

// Estilização com inclusão dos novos componentes visuais
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
    position: 'relative',
    touchAction: 'none', // Permite o manuseio suave via touch no mobile
  },
  floatingTouchControl: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    zIndex: 10,
    width: '220px',
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
  sectionBox: {
    backgroundColor: '#162b4d',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px',
    border: '1px solid #1e3a66',
  },
  gridButtons: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '6px',
  },
  flexRow: {
    display: 'flex',
    gap: '8px',
  },
  btnDirection: {
    backgroundColor: '#1e293b',
    color: '#fff',
    border: '1px solid #334155',
    padding: '8px',
    fontSize: '11px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  btnAction: {
    flex: 1,
    backgroundColor: '#0284c7',
    color: '#fff',
    border: 'none',
    padding: '8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
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
