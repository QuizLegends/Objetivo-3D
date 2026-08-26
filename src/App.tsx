import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ThreeManager } from './threeScene';

interface AttachedProp {
  id: string;
  name: string;
  object: THREE.Object3D;
  boneName: string;
  scale: number;
  posX: number; posY: number; posZ: number;
  rotX: number; rotY: number; rotZ: number;
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<ThreeManager | null>(null);

  const [characterLoaded, setCharacterLoaded] = useState(false);
  const [bones, setBones] = useState<THREE.Bone[]>([]);
  const [animations, setAnimations] = useState<THREE.AnimationClip[]>([]);
  const [showAnimMenu, setShowAnimMenu] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [brightness, setBrightness] = useState(1.2);
  const [charScale, setCharScale] = useState(100);

  const [pendingProp, setPendingProp] = useState<{ object: THREE.Object3D; name: string } | null>(null);
  const [selectedBone, setSelectedBone] = useState('');
  const [propsList, setPropsList] = useState<AttachedProp[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);

  const charInputRef = useRef<HTMLInputElement>(null);
  const propInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const mgr = new ThreeManager(containerRef.current);
      managerRef.current = mgr;

      const handleResize = () => {
        if (containerRef.current) {
          mgr.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        mgr.dispose();
      };
    }
  }, []);

  // Upload Personagem
  const handleCharUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && managerRef.current) {
      managerRef.current.loadCharacter(file, (loadedBones, loadedAnims) => {
        setBones(loadedBones);
        setAnimations(loadedAnims);
        setCharacterLoaded(true);
      });
    }
  };

  // Upload Objeto
  const handlePropUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && managerRef.current) {
      managerRef.current.loadProp(file, (obj) => {
        setPendingProp({ object: obj, name: file.name });
      });
    }
  };

  // Anexar Objeto ao Osso
  const confirmAttach = () => {
    if (!pendingProp || !selectedBone || !managerRef.current) return;
    const ok = managerRef.current.attachToBone(pendingProp.object, selectedBone);
    if (ok) {
      const newProp: AttachedProp = {
        id: Math.random().toString(36).substring(2, 9),
        name: pendingProp.name,
        object: pendingProp.object,
        boneName: selectedBone,
        scale: 100,
        posX: 0, posY: 0, posZ: 0,
        rotX: 0, rotY: 0, rotZ: 0,
      };
      setPropsList((prev) => [...prev, newProp]);
      setSelectedPropId(newProp.id);
      setPendingProp(null);
    }
  };

  // Atualizar transformação do objeto
  const updateTransform = (id: string, key: keyof AttachedProp, value: number) => {
    setPropsList((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, [key]: value };

        const s = updated.scale / 100;
        updated.object.scale.set(s, s, s);
        updated.object.position.set(updated.posX, updated.posY, updated.posZ);
        updated.object.rotation.set(
          THREE.MathUtils.degToRad(updated.rotX),
          THREE.MathUtils.degToRad(updated.rotY),
          THREE.MathUtils.degToRad(updated.rotZ)
        );
        return updated;
      })
    );
  };

  const selectedProp = propsList.find((p) => p.id === selectedPropId);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#071220] text-slate-100 font-sans select-none overflow-hidden">
      {/* Topo / Navbar */}
      <header className="h-14 bg-[#071220] border-b border-[#1e3a5f] px-4 flex items-center justify-between z-10 shrink-0">
        <div className="text-blue-400 font-bold text-base flex items-center gap-2">
          <span>⬡ Editor 3D</span>
        </div>
        <div className="flex items-center gap-2">
          <input ref={charInputRef} type="file" accept=".fbx,.glb,.gltf" className="hidden" onChange={handleCharUpload} />
          <button onClick={() => charInputRef.current?.click()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-semibold">
            👤 Personagem
          </button>

          <input ref={propInputRef} type="file" accept=".fbx,.glb,.gltf" className="hidden" onChange={handlePropUpload} />
          <button onClick={() => propInputRef.current?.click()} disabled={!characterLoaded} className="px-3 py-1.5 bg-[#142843] hover:bg-[#1e3a5f] disabled:opacity-40 rounded text-xs border border-[#1e3a5f]">
            📦 Objeto
          </button>

          <button onClick={() => setShowAnimMenu(!showAnimMenu)} disabled={!characterLoaded || animations.length === 0} className="px-3 py-1.5 bg-[#142843] hover:bg-[#1e3a5f] disabled:opacity-40 rounded text-xs border border-[#1e3a5f]">
            🎬 Animações ({animations.length})
          </button>
        </div>

        <button onClick={() => managerRef.current?.exportGLB()} disabled={!characterLoaded} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded text-xs font-semibold">
          💾 Baixar GLB
        </button>
      </header>

      {/* Área Central */}
      <div className="flex-1 flex relative">
        {/* Viewport 3D */}
        <div ref={containerRef} className="flex-1 w-full h-full" />

        {/* Modal de Animações */}
        {showAnimMenu && (
          <div className="absolute top-4 left-4 z-20 w-56 bg-[#071220]/95 border border-[#1e3a5f] rounded-lg p-3 shadow-xl space-y-2 text-xs">
            <div className="font-bold text-blue-300 border-b border-[#1e3a5f] pb-1 flex justify-between">
              <span>Animações</span>
              <button onClick={() => setShowAnimMenu(false)}>✕</button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {animations.map((a) => (
                <button
                  key={a.name}
                  onClick={() => {
                    managerRef.current?.playAnimation(a);
                    setIsPlaying(true);
                  }}
                  className="w-full text-left p-1.5 bg-[#142843] hover:bg-blue-600 rounded"
                >
                  ▶ {a.name || 'Animação'}
                </button>
              ))}
            </div>
            {isPlaying && (
              <button
                onClick={() => {
                  managerRef.current?.stopAnimation();
                  setIsPlaying(false);
                }}
                className="w-full py-1 bg-red-600 hover:bg-red-500 rounded font-semibold"
              >
                ⏹ Parar
              </button>
            )}
          </div>
        )}

        {/* Painel de Propriedades Lateral */}
        <aside className="w-80 bg-[#071220] border-l border-[#1e3a5f] p-4 space-y-4 overflow-y-auto text-xs">
          {/* Brilho */}
          <div className="bg-[#0f2035] p-3 rounded-lg border border-[#1e3a5f] space-y-2">
            <label className="text-blue-300 font-semibold block">Controle de Brilho</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const b = Math.max(0.2, brightness - 0.2);
                  setBrightness(b);
                  managerRef.current?.setBrightness(b);
                }}
                className="flex-1 py-1 bg-[#142843] hover:bg-[#1e3a5f] rounded"
              >
                − Brilho
              </button>
              <span className="font-mono text-blue-400">{brightness.toFixed(1)}</span>
              <button
                onClick={() => {
                  const b = brightness + 0.2;
                  setBrightness(b);
                  managerRef.current?.setBrightness(b);
                }}
                className="flex-1 py-1 bg-[#142843] hover:bg-[#1e3a5f] rounded"
              >
                + Brilho
              </button>
            </div>
          </div>

          {/* Tamanho Personagem */}
          {characterLoaded && (
            <div className="bg-[#0f2035] p-3 rounded-lg border border-[#1e3a5f] space-y-2">
              <div className="flex justify-between font-semibold text-blue-300">
                <span>Tamanho Personagem</span>
                <span className="text-blue-400">{charScale}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="300"
                value={charScale}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCharScale(val);
                  managerRef.current?.setCharacterScale(val);
                }}
                className="w-full accent-blue-500"
              />
            </div>
          )}

          {/* Form de Anexação ao Osso */}
          {pendingProp && (
            <div className="bg-amber-950/40 border border-amber-600/50 p-3 rounded-lg space-y-2">
              <div className="font-semibold text-amber-300">Anexar: {pendingProp.name}</div>
              <select
                value={selectedBone}
                onChange={(e) => setSelectedBone(e.target.value)}
                className="w-full bg-[#071220] border border-amber-600/50 rounded p-1 text-amber-200"
              >
                <option value="">-- Selecione o Osso --</option>
                {bones.map((b) => (
                  <option key={b.uuid} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button onClick={confirmAttach} disabled={!selectedBone} className="w-full py-1.5 bg-emerald-600 disabled:opacity-40 rounded font-semibold">
                Confirmar Anexação
              </button>
            </div>
          )}

          {/* Objetos Ativos */}
          {propsList.length > 0 && (
            <div className="bg-[#0f2035] p-3 rounded-lg border border-[#1e3a5f] space-y-2">
              <label className="text-blue-300 font-semibold block">Objetos na Cena</label>
              {propsList.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPropId(p.id)}
                  className={`p-2 rounded cursor-pointer border ${
                    selectedPropId === p.id ? 'bg-blue-600/40 border-blue-400' : 'bg-[#142843] border-transparent'
                  }`}
                >
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-[10px] text-blue-400">Osso: {p.boneName}</div>
                </div>
              ))}
            </div>
          )}

          {/* Ajuste Fino do Objeto Selecionado */}
          {selectedProp && (
            <div className="bg-[#0f2035] p-3 rounded-lg border border-[#1e3a5f] space-y-3">
              <div className="font-semibold text-blue-300 border-b border-[#1e3a5f] pb-1">
                Ajustar: {selectedProp.name}
              </div>

              <div>
                <label className="text-blue-300">Tamanho ({selectedProp.scale}%)</label>
                <input
                  type="range"
                  min="10"
                  max="300"
                  value={selectedProp.scale}
                  onChange={(e) => updateTransform(selectedProp.id, 'scale', Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>

              {/* Posições */}
              {(['posX', 'posY', 'posZ'] as const).map((axis) => (
                <div key={axis}>
                  <label className="text-blue-300">Posição {axis.replace('pos', '').toUpperCase()}</label>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    step="0.01"
                    value={selectedProp[axis]}
                    onChange={(e) => updateTransform(selectedProp.id, axis, parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              ))}

              {/* Rotações */}
              {(['rotX', 'rotY', 'rotZ'] as const).map((axis) => (
                <div key={axis}>
                  <label className="text-blue-300">Rotação {axis.replace('rot', '').toUpperCase()} (°)</label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={selectedProp[axis]}
                    onChange={(e) => updateTransform(selectedProp.id, axis, Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
