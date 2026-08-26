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
    <div style={{ display: 'flex', width: '100vw', height: '100vh', backgroundColor: '#071220', color: '#fff' }}>
      <div ref={containerRef} style={{ flex: 1, height: '100%' }} />

      <div style={{ width: '320px', padding: '16px', backgroundColor: '#0d1f38', overflowY: 'auto' }}>
        <h3>Controles 3D</h3>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px' }}>Personagem (FBX/GLB):</label>
          <input type="file" accept=".fbx,.glb,.gltf" onChange={handleCharacterUpload} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px' }}>Objeto / Arma (FBX/GLB):</label>
          <input type="file" accept=".fbx,.glb,.gltf" onChange={handlePropUpload} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px' }}>Textura do Objeto (PNG/JPG):</label>
          <input type="file" accept="image/png, image/jpeg" onChange={handlePropTextureUpload} />
        </div>

        {bones.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px' }}>Selecione o Osso:</label>
            <select
              value={selectedBone}
              onChange={(e) => setSelectedBone(e.target.value)}
              style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
            >
              <option value="">Selecione...</option>
              {bones.map((b) => (
                <option key={b.uuid} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAttachProp}
              style={{ width: '100%', padding: '8px', backgroundColor: '#10b981', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Anexar Objeto ao Osso
            </button>
          </div>
        )}

        {animations.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h4>Animações</h4>
            {animations.map((anim, idx) => (
              <button
                key={idx}
                onClick={() => handlePlayAnim(anim)}
                style={{ display: 'block', width: '100%', padding: '6px', marginBottom: '4px' }}
              >
                ▶️ {anim.name || `Animação ${idx + 1}`}
              </button>
            ))}
            <button
              onClick={handleStopAnim}
              style={{ display: 'block', width: '100%', padding: '6px', marginTop: '8px', backgroundColor: '#ef4444', color: '#fff', border: 'none' }}
            >
              ⏹️ Parar Animação
            </button>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px' }}>Brilho ({brightness}):</label>
          <input
            type="range"
            min="0.2"
            max="4"
            step="0.1"
            value={brightness}
            onChange={handleBrightnessChange}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px' }}>Escala do Personagem ({scale}%):</label>
          <input
            type="range"
            min="10"
            max="300"
            step="5"
            value={scale}
            onChange={handleScaleChange}
            style={{ width: '100%' }}
          />
        </div>

        <button
          onClick={handleExportGLB}
          style={{ width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
        >
          📥 Exportar GLB Animado
        </button>
      </div>
    </div>
  );
};
