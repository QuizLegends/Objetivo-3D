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

  // Upload do Personagem
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

  // Upload do Objeto / Armamento
  const handlePropUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && managerRef.current) {
      managerRef.current.loadProp(file, (obj) => {
        setPendingProp({ object: obj, name: file.name });
      });
    }
  };

  // Confirmar Fixação no Osso
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

  // Atualização Numérica de Transformação
  const updateTransform = (id: string, key: keyof AttachedProp, delta: number, isAbsolute = false) => {
    setPropsList((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        
        let newVal = isAbsolute ? delta : (p[key] as number) + delta;
        
        // Ajuste fino com 2 casas decimais para posição
        if (typeof newVal === 'number' && key.startsWith('pos')) {
          newVal = parseFloat(newVal.toFixed(2));
        }

        const updated = { ...p, [key]: newVal };

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
      {/* Topo / Barra de Ações */}
      <header className="h-14 bg-[#071220] border-b border-[#1e3a5f] px-3 flex items-center justify-between z-10 shrink-0">
        <div className="text-blue-400 font-bold text-sm flex items-center gap-1">
          <span>⬡ Editor 3D</span>
        </div>
        <div className="flex items-center gap-1.5">
          <input ref={charInputRef} type="file" accept=".fbx,.glb,.gltf" className="hidden" onChange={handleCharUpload} />
          <button onClick={() => charInputRef.current?.click()} className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-semibold">
            👤 Personagem
          </button>

          <input ref={propInputRef} type="file" accept=".fbx,.glb,.gltf" className="hidden" onChange={handlePropUpload} />
          <button onClick={() => propInputRef.current?.click()} disabled={!characterLoaded} className="px-2.5 py-1.5 bg-[#142843] hover:bg-[#1e3a5f] disabled:opacity-40 rounded text-xs border border-[#1e3a5f]">
            📦 Objeto
          </button>

          <button onClick={() => setShowAnimMenu(!showAnimMenu)} disabled={!characterLoaded || animations.length === 0} className="px-2.5 py-1.5 bg-[#142843] hover:bg-[#1e3a5f] disabled:opacity-40 rounded text-xs border border-[#1e3a5f]">
            🎬 Animações ({animations.length})
          </button>
        </div>

        <button onClick={() => managerRef.current?.exportGLB()} disabled={!characterLoaded} className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded text-xs font-semibold">
          💾 Baixar GLB
        </button>
      </header>

      {/* Viewport Principal + Painel */}
      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        {/* Canvas 3D */}
        <div ref={containerRef} className="flex-1 w-full h-full min-h-[300px]" />

        {/* Modal Flutuante de Animações */}
        {showAnimMenu && (
          <div className="absolute top-3 left-3 z-20 w-60 bg-[#071220]/95 border border-[#1e3a5f] rounded-lg p-3 shadow-xl space-y-2 text-xs">
            <div className="font-bold text-blue-300 border-b border-[#1e3a5f] pb-1 flex justify-between">
              <span>Lista de Animações</span>
              <button onClick={() => setShowAnimMenu(false)}>✕</button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {animations.map((a) => (
                <button
                  key={a.name}
                  onClick={() => {
                    managerRef.current?.playAnimation(a);
                    setIsPlaying(true);
                  }}
                  className="w-full text-left p-2 bg-[#142843] hover:bg-blue-600 rounded font-medium"
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
                className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 rounded font-semibold text-white"
              >
                ⏹ Parar Animação
              </button>
            )}
          </div>
        )}

        {/* Painel Inferior de Controles (Ideal para Celular) */}
        <aside className="w-full md:w-80 bg-[#071220] border-t md:border-t-0 md:border-l border-[#1e3a5f] p-3 space-y-3 overflow-y-auto max-h-[50vh] md:max-h-none text-xs">
          
          {/* Controle de Luz e Tamanho do Personagem */}
          <div className="bg-[#0f2035] p-2.5 rounded-lg border border-[#1e3a5f] space-y-2">
            <div className="flex justify-between items-center text-blue-300 font-semibold">
              <span>Brilho do Cenário</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const b = Math.max(0.2, brightness - 0.2);
                    setBrightness(b);
                    managerRef.current?.setBrightness(b);
                  }}
                  className="w-7 h-7 bg-[#142843] hover:bg-[#1e3a5f] rounded font-bold"
                >
                  −
                </button>
                <span className="font-mono text-blue-400">{brightness.toFixed(1)}</span>
                <button
                  onClick={() => {
                    const b = brightness + 0.2;
                    setBrightness(b);
                    managerRef.current?.setBrightness(b);
                  }}
                  className="w-7 h-7 bg-[#142843] hover:bg-[#1e3a5f] rounded font-bold"
                >
                  +
                </button>
              </div>
            </div>

            {characterLoaded && (
              <div className="flex justify-between items-center text-blue-300 font-semibold pt-1 border-t border-[#1e3a5f]/50">
                <span>Tamanho Personagem</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const s = Math.max(10, charScale - 10);
                      setCharScale(s);
                      managerRef.current?.setCharacterScale(s);
                    }}
                    className="w-7 h-7 bg-[#142843] hover:bg-[#1e3a5f] rounded font-bold"
                  >
                    −
                  </button>
                  <span className="font-mono text-blue-400">{charScale}%</span>
                  <button
                    onClick={() => {
                      const s = charScale + 10;
                      setCharScale(s);
                      managerRef.current?.setCharacterScale(s);
                    }}
                    className="w-7 h-7 bg-[#142843] hover:bg-[#1e3a5f] rounded font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Seleção de Osso para Fixação */}
          {pendingProp && (
            <div className="bg-amber-950/40 border border-amber-600/50 p-2.5 rounded-lg space-y-2">
              <div className="font-semibold text-amber-300">Anexar: {pendingProp.name}</div>
              <select
                value={selectedBone}
                onChange={(e) => setSelectedBone(e.target.value)}
                className="w-full bg-[#071220] border border-amber-600/50 rounded p-1.5 text-amber-200"
              >
                <option value="">-- Selecione o Osso (Mão/Braço) --</option>
                {bones.map((b) => (
                  <option key={b.uuid} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button
                onClick={confirmAttach}
                disabled={!selectedBone}
                className="w-full py-2 bg-cyan-600 active:bg-cyan-700 disabled:opacity-40 rounded font-bold text-white shadow"
              >
                🔒 Fixar no Personagem
              </button>
            </div>
          )}

          {/* Lista de Objetos Na Cena */}
          {propsList.length > 0 && (
            <div className="bg-[#0f2035] p-2.5 rounded-lg border border-[#1e3a5f] space-y-1.5">
              <label className="text-blue-300 font-semibold block">Objetos Fixados</label>
              {propsList.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPropId(p.id)}
                  className={`p-2 rounded cursor-pointer border flex justify-between items-center ${
                    selectedPropId === p.id ? 'bg-blue-600/40 border-blue-400' : 'bg-[#142843] border-transparent'
                  }`}
                >
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-[10px] text-blue-300 bg-blue-950 px-1.5 py-0.5 rounded border border-blue-800">
                    {p.boneName}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Painel de Ajuste Fino Numérico (Botões + / -) */}
          {selectedProp && (
            <div className="bg-[#0f2035] p-3 rounded-lg border border-[#1e3a5f] space-y-2.5">
              <div className="font-bold text-blue-300 border-b border-[#1e3a5f] pb-1 flex justify-between items-center">
                <span>Ajustar: {selectedProp.name}</span>
                <span className="text-[10px] text-emerald-400 font-mono">FIXADO</span>
              </div>

              {/* Controles Botões + e - */}
              <div className="space-y-2">
                {/* Cima / Baixo */}
                <div className="flex items-center justify-between bg-[#142843] p-1.5 rounded border border-[#1e3a5f]">
                  <span className="font-medium text-slate-200">Cima / Baixo</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateTransform(selectedProp.id, 'posY', -0.05)}
                      className="w-8 h-8 bg-rose-600 active:bg-rose-700 font-bold rounded text-base flex items-center justify-center text-white"
                    >
                      −
                    </button>
                    <span className="w-12 text-center font-mono text-xs bg-[#071220] py-1 rounded border border-[#1e3a5f]">
                      {selectedProp.posY.toFixed(2)}
                    </span>
                    <button
                      onClick={() => updateTransform(selectedProp.id, 'posY', 0.05)}
                      className="w-8 h-8 bg-emerald-600 active:bg-emerald-700 font-bold rounded text-base flex items-center justify-center text-white"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Esquerda / Direita */}
                <div className="flex items-center justify-between bg-[#142843] p-1.5 rounded border border-[#1e3a5f]">
                  <span className="font-medium text-slate-200">Esquerda / Direita</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateTransform(selectedProp.id, 'posX', -0.05)}
                      className="w-8 h-8 bg-rose-600 active:bg-rose-700 font-bold rounded text-base flex items-center justify-center text-white"
                    >
                      −
                    </button>
                    <span className="w-12 text-center font-mono text-xs bg-[#071220] py-1 rounded border border-[#1e3a5f]">
                      {selectedProp.posX.toFixed(2)}
                    </span>
                    <button
                      onClick={() => updateTransform(selectedProp.id, 'posX', 0.05)}
                      className="w-8 h-8 bg-emerald-600 active:bg-emerald-700 font-bold rounded text-base flex items-center justify-center text-white"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Frente / Trás */}
                <div className="flex items-center justify-between bg-[#142843] p-1.5 rounded border border-[#1e3a5f]">
                  <span className="font-medium text-slate-200">Frente / Trás</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateTransform(selectedProp.id, 'posZ', -0.05)}
                      className="w-8 h-8 bg-rose-600 active:bg-rose-700 font-bold rounded text-base flex items-center justify-center text-white"
                    >
                      −
                    </button>
                    <span className="w-12 text-center font-mono text-xs bg-[#071220] py-1 rounded border border-[#1e3a5f]">
                      {selectedProp.posZ.toFixed(2)}
                    </span>
                    <button
                      onClick={() => updateTransform(selectedProp.id, 'posZ', 0.05)}
                      className="w-8 h-8 bg-emerald-600 active:bg-emerald-700 font-bold rounded text-base flex items-center justify-center text-white"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Girar 360 Graus */}
                <div className="flex items-center justify-between bg-[#142843] p-1.5 rounded border border-[#1e3a5f]">
                  <span className="font-medium text-slate-200">Girar (360°)</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateTransform(selectedProp.id, 'rotY', -15)}
                      className="w-8 h-8 bg-indigo-600 active:bg-indigo-700 font-bold rounded text-xs flex items-center justify-center text-white"
                    >
                      -15°
                    </button>
                    <span className="w-12 text-center font-mono text-xs bg-[#071220] py-1 rounded border border-[#1e3a5f]">
                      {selectedProp.rotY}°
                    </span>
                    <button
                      onClick={() => updateTransform(selectedProp.id, 'rotY', 15)}
                      className="w-8 h-8 bg-indigo-600 active:bg-indigo-700 font-bold rounded text-xs flex items-center justify-center text-white"
                    >
                      +15°
                    </button>
                  </div>
                </div>

                {/* Tamanho Objeto */}
                <div className="flex items-center justify-between bg-[#142843] p-1.5 rounded border border-[#1e3a5f]">
                  <span className="font-medium text-slate-200">Tamanho Objeto</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateTransform(selectedProp.id, 'scale', -10)}
                      className="w-8 h-8 bg-amber-600 active:bg-amber-700 font-bold rounded text-base flex items-center justify-center text-white"
                    >
                      −
                    </button>
                    <span className="w-12 text-center font-mono text-xs bg-[#071220] py-1 rounded border border-[#1e3a5f]">
                      {selectedProp.scale}%
                    </span>
                    <button
                      onClick={() => updateTransform(selectedProp.id, 'scale', 10)}
                      className="w-8 h-8 bg-amber-600 active:bg-amber-700 font-bold rounded text-base flex items-center justify-center text-white"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
