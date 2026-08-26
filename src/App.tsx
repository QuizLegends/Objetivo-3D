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

  // Posição, Rotação e Escala do Objeto
  const [propPos, setPropPos] = useState({ x: 0, y: 0, z: 0 });
  const [propRot, setPropRot] = useState({ x: 0, y: 0, z: 0 });
  const [propScale, setPropScale] = useState<number>(1);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');

  useEffect(() => {
    if (containerRef.current && !threeManagerRef.current) {
      const manager = new ThreeManager(containerRef.current);
      threeManagerRef.current = manager;

      manager.setTransformCallback((pos, rot, scale) => {
        setPropPos({ x: Number(pos.x.toFixed(2)), y: Number(pos.y.toFixed(2)), z: Number(pos.z.toFixed(2)) });
        setPropRot({ x: Number(rot.x.toFixed(0)), y: Number(rot.y.toFixed(0)), z: Number(rot.z.toFixed(0)) });
        setPropScale(Number(scale.x.toFixed(2)));
      });

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

  const updatePos = (axis: 'x' | 'y' | 'z', delta: number) => {
    const newPos = { ...propPos, [axis]: Number((propPos[axis] + delta).toFixed(2)) };
    setPropPos(newPos);
    threeManagerRef.current?.setPropPosition(newPos.x, newPos.y, newPos.z);
  };

  const setPosDirect = (axis: 'x' | 'y' | 'z', val: number) => {
    const newPos = { ...propPos, [axis]: val };
    setPropPos(newPos);
    threeManagerRef.current?.setPropPosition(newPos.x, newPos.y, newPos.z);
  };

  const updateRot = (axis: 'x' | 'y' | 'z', delta: number) => {
    const newRot = { ...propRot, [axis]: (propRot[axis] + delta + 360) % 360 };
    setPropRot(newRot);
    threeManagerRef.current?.setPropRotation(newRot.x, newRot.y, newRot.z);
  };

  const setRotDirect = (axis: 'x' | 'y' | 'z', val: number) => {
    const newRot = { ...propRot, [axis]: val };
    setPropRot(newRot);
    threeManagerRef.current?.setPropRotation(newRot.x, newRot.y, newRot.z);
  };

  // Atualizar tamanho do objeto
  const updatePropScale = (delta: number) => {
    const newScale = Math.max(0.05, Number((propScale + delta).toFixed(2)));
    setPropScale(newScale);
    threeManagerRef.current?.setPropUniformScale(newScale);
  };

  const setPropScaleDirect = (val: number) => {
    const newScale = Math.max(0.05, val);
    setPropScale(newScale);
    threeManagerRef.current?.setPropUniformScale(newScale);
  };

  const handleModeChange = (mode: 'translate' | 'rotate' | 'scale') => {
    setTransformMode(mode);
    threeManagerRef.current?.setTransformMode(mode);
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

        {bones.length > 0 && (
          <div style={styles.formGroup}>
            <label style={styles.label}>Selecione o Osso:</label>
            <select value={selectedBone} onChange={(e) => setSelectedBone(e.target.value)} style={styles.select}>
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

        {currentProp && (
          <div style={styles.transformSection}>
            <h4 style={styles.subtitle}>Ajustar Objeto (Tamanho / Posição)</h4>
            
            {/* Seletor de Ação de Toque na Tela */}
            <div style={styles.modeGroup}>
              <button
                type="button"
                style={transformMode === 'translate' ? styles.activeModeBtn : styles.modeBtn}
                onClick={() => handleModeChange('translate')}
              >
                🖐️ Mover
              </button>
              <button
                type="button"
                style={transformMode === 'rotate' ? styles.activeModeBtn : styles.modeBtn}
                onClick={() => handleModeChange('rotate')}
              >
                🔄 Girar 360°
              </button>
              <button
                type="button"
                style={transformMode === 'scale' ? styles.activeModeBtn : styles.modeBtn}
                onClick={() => handleModeChange('scale')}
              >
                🔍 Redimensionar
              </button>
            </div>

            {/* Aumentar / Diminuir Objeto */}
            <div style={styles.axisGroup}>
              <span style={styles.axisLabel}>Tamanho do Objeto (Escala):</span>
              <div style={styles.inlineControls}>
                <span style={styles.nameKey}>Aumentar / Diminuir:</span>
                <button type="button" style={styles.stepBtn} onClick={() => updatePropScale(-0.1)}>-</button>
                <input
                  type="number"
                  step="0.05"
                  value={propScale}
                  onChange={(e) => setPropScaleDirect(parseFloat(e.target.value) || 1)}
                  style={styles.numInput}
                />
                <button type="button" style={styles.stepBtn} onClick={() => updatePropScale(0.1)}>+</button>
              </div>
            </div>

            {/* Posição */}
            <div style={styles.axisGroup}>
              <span style={styles.axisLabel}>Posição no Espaço:</span>
              <div style={styles.inlineControls}>
                <span style={styles.nameKey}>Esquerda / Direita:</span>
                <button type="button" style={styles.stepBtn} onClick={() => updatePos('x', -0.05)}>-</button>
                <input
                  type="number"
                  step="0.01"
                  value={propPos.x}
                  onChange={(e) => setPosDirect('x', parseFloat(e.target.value) || 0)}
                  style={styles.numInput}
                />
                <button type="button" style={styles.stepBtn} onClick={() => updatePos('x', 0.05)}>+</button>
              </div>

              <div style={styles.inlineControls}>
                <span style={styles.nameKey}>Cima / Baixo:</span>
                <button type="button" style={styles.stepBtn} onClick={() => updatePos('y', -0.05)}>-</button>
                <input
                  type="number"
                  step="0.01"
                  value={propPos.y}
                  onChange={(e) => setPosDirect('y', parseFloat(e.target.value) || 0)}
                  style={styles.numInput}
                />
                <button type="button" style={styles.stepBtn} onClick={() => updatePos('y', 0.05)}>+</button>
              </div>

              <div style={styles.inlineControls}>
                <span style={styles.nameKey}>Frente / Trás:</span>
                <button type="button" style={styles.stepBtn} onClick={() => updatePos('z', -0.05)}>-</button>
                <input
                  type="number"
                  step="0.01"
                  value={propPos.z}
                  onChange={(e) => setPosDirect('z', parseFloat(e.target.value) || 0)}
                  style={styles.numInput}
                />
                <button type="button" style={styles.stepBtn} onClick={() => updatePos('z', 0.05)}>+</button>
              </div>
            </div>

            {/* Rotação */}
            <div style={styles.axisGroup}>
              <span style={styles.axisLabel}>Giro & Rotação (360°):</span>
              <div style={styles.inlineControls}>
                <span style={styles.nameKey}>Giro Lado a Lado:</span>
                <button type="button" style={styles.stepBtn} onClick={() => updateRot('y', -5)}>-</button>
                <input
                  type="number"
                  value={propRot.y}
                  onChange={(e) => setRotDirect('y', parseInt(e.target.value, 10) || 0)}
                  style={styles.numInput}
                />
                <button type="button" style={styles.stepBtn} onClick={() => updateRot('y', 5)}>+</button>
              </div>

              <div style={styles.inlineControls}>
                <span style={styles.nameKey}>Inclinar Frente/Trás:</span>
                <button type="button" style={styles.stepBtn} onClick={() => updateRot('x', -5)}>-</button>
                <input
                  type="number"
                  value={propRot.x}
                  onChange={(e) => setRotDirect('x', parseInt(e.target.value, 10) || 0)}
                  style={styles.numInput}
                />
                <button type="button" style={styles.stepBtn} onClick={() => updateRot('x', 5)}>+</button>
              </div>

              <div style={styles.inlineControls}>
                <span style={styles.nameKey}>Inclinar Lado/Lado:</span>
                <button type="button" style={styles.stepBtn} onClick={() => updateRot('z', -5)}>-</button>
                <input
                  type="number"
                  value={propRot.z}
                  onChange={(e) => setRotDirect('z', parseInt(e.target.value, 10) || 0)}
                  style={styles.numInput}
                />
                <button type="button" style={styles.stepBtn} onClick={() => updateRot('z', 5)}>+</button>
              </div>
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
                  onClick={() => threeManagerRef.current?.playAnimation(anim)}
                  style={{ ...styles.btn, ...styles.btnAnim }}
                >
                  ▶️ {anim.name || `Animação ${idx + 1}`}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => threeManagerRef.current?.stopAnimation()}
              style={{ ...styles.btn, ...styles.btnStop }}
            >
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
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setBrightness(val);
              threeManagerRef.current?.setBrightness(val);
            }}
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
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setScale(val);
              threeManagerRef.current?.setCharacterScale(val);
            }}
            style={styles.range}
          />
        </div>

        <button type="button" onClick={() => threeManagerRef.current?.exportGLB()} style={{ ...styles.btn, ...styles.btnExport }}>
          📥 Exportar GLB Animado
        </button>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  appContainer: { display: 'flex', width: '100vw', height: '100vh', backgroundColor: '#071220', color: '#fff', fontFamily: 'Arial, sans-serif', overflow: 'hidden' },
  canvasContainer: { flex: 1, height: '100%' },
  sidebar: { width: '360px', height: '100%', backgroundColor: '#0d1f38', padding: '16px', overflowY: 'auto', borderLeft: '1px solid #1e293b', boxSizing: 'border-box' },
  title: { marginBottom: '12px', fontSize: '18px', fontWeight: 'bold' },
  subtitle: { margin: '12px 0 8px 0', fontSize: '14px', color: '#e2e8f0' },
  formGroup: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '13px', marginBottom: '6px', color: '#94a3b8' },
  spanVal: { color: '#38bdf8', fontWeight: 'bold' },
  input: { width: '100%', padding: '8px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '4px', boxSizing: 'border-box' },
  select: { width: '100%', padding: '8px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '4px', marginBottom: '8px', boxSizing: 'border-box' },
  range: { width: '100%', accentColor: '#38bdf8' },
  animList: { maxHeight: '150px', overflowY: 'auto', marginBottom: '6px' },
  btn: { width: '100%', padding: '10px', marginTop: '4px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', boxSizing: 'border-box' },
  btnAttach: { backgroundColor: '#10b981', color: '#fff' },
  btnAnim: { backgroundColor: '#3b82f6', color: '#fff', marginBottom: '6px' },
  btnStop: { backgroundColor: '#ef4444', color: '#fff' },
  btnExport: { backgroundColor: '#8b5cf6', color: '#fff', padding: '12px', marginTop: '12px' },
  transformSection: { padding: '12px', backgroundColor: '#0f172a', borderRadius: '6px', border: '1px solid #1e293b', marginBottom: '16px' },
  modeGroup: { display: 'flex', gap: '6px', marginBottom: '12px' },
  modeBtn: { flex: 1, padding: '6px 4px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' },
  activeModeBtn: { flex: 1, padding: '6px 4px', backgroundColor: '#0284c7', border: '1px solid #0369a1', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' },
  axisGroup: { marginBottom: '12px' },
  axisLabel: { fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 'bold' },
  inlineControls: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '6px' },
  nameKey: { width: '130px', fontSize: '12px', color: '#38bdf8' },
  stepBtn: { padding: '4px 8px', backgroundColor: '#334155', border: 'none', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' },
  numInput: { width: '55px', padding: '4px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '3px', textAlign: 'center', fontSize: '12px' }
};

export default App;
