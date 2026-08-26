import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ThreeManager } from './threeScene';

interface PropItem {
  id: string;
  name: string;
  object: THREE.Object3D;
  scale: number;
  posX: number; posY: number; posZ: number;
  rotX: number; rotY: number; rotZ: number;
  attachedBoneName: string | null;
  isAttached: boolean;
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

  const [propsList, setPropsList] = useState<PropItem[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
  const [targetBoneForSelect, setTargetBoneForSelect] = useState<string>('');

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
        const newId = Math.random().toString(36).substring(2, 9);
        const newProp: PropItem = {
          id: newId,
          name: file.name,
          object: obj,
          scale: 100,
          posX: 0, posY: 1, posZ: 0,
          rotX: 0, rotY: 0, rotZ: 0,
          attachedBoneName: null,
          isAttached: false
        };
        setPropsList((prev) => [...prev, newProp]);
        setSelectedPropId(newId);
      });
    }
  };

  // Atualização Numérica (Através do botão ou digitando direto no input)
  const setTransformValue = (id: string, key: keyof PropItem, value: number) => {
    setPropsList((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;

        let newVal = value;
        if (key === 'scale') {
          newVal = Math.max(1, newVal);
        } else if (key.startsWith('rot')) {
          newVal = (newVal % 360 + 360) % 360;
        }

        const updated = { ...p, [key]: newVal };

        // Aplica transformações
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

  const updateTransformDelta = (id: string, key: keyof PropItem, delta: number) => {
    const prop = propsList.find((p) => p.id === id);
    if (!prop) return;
    const currentVal = (prop[key] as number) || 0;
    const finalVal = parseFloat((currentVal + delta).toFixed(2));
    setTransformValue(id, key, finalVal);
  };

  // Executar Fixação do Objeto no Osso do Personagem
  const confirmFinalAttach = (propId: string) => {
    if (!targetBoneForSelect || !managerRef.current) return;

    const prop = propsList.find((p) => p.id === propId);
    if (!prop) return;

    const success = managerRef.current.attachToBone(prop.object, targetBoneForSelect);

    if (success) {
      setPropsList((prev) =>
        prev.map((p) =>
          p.id === propId
            ? { ...p, isAttached: true, attachedBoneName: targetBoneForSelect }
            : p
        )
      );
    }
  };

  // Soltar Objeto do Osso
  const detachProp = (propId: string) => {
    const prop = propsList.find((p) => p.id === propId);
    if (!prop || !managerRef.current) return;

    managerRef.current.detachFromBone(prop.object);
    setPropsList((prev) =>
      prev.map((p) =>
        p.id === propId
          ? { ...p, isAttached: false, attachedBoneName: null }
          : p
      )
    );
  };

  const selectedProp = propsList.find((p) => p.id === selectedPropId);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#071220] text-slate-100 font-sans select-none overflow-hidden">
      {/* Topo / Barra de Ações */}
      <header className="h-14 bg-[#071220] border-b border-[#1e3a5f] px-3 flex items-center justify-between z-10 shrink-0">
        <div className="text-blue-400 font-bold text-sm flex items-center gap-1">
          <span>⬡ Conversel 3D</span>
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

        {/* Painel Inferior de Controles */}
        <aside className="w-full md:w-80 bg-[#071220] border-t md:border-t-0 md:border-l border-[#1e3a5f] p-3 space-y-3 overflow-y-auto max-h-[50vh] md:max-h-none text-xs">
          
          {/* Luz e Tamanho do Personagem */}
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
                <input
                  type="number"
                  step="0.1"
                  value={brightness}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setBrightness(val);
                    managerRef.current?.setBrightness(val);
                  }}
                  className="w-12 text-center font-mono text-xs bg-[#071220] py-1 rounded border border-[#1e3a5f] text-cyan-300 focus:outline-none"
                />
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
                  <input
                    type="number"
                    value={charScale}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setCharScale(val);
                      managerRef.current?.setCharacterScale(val);
                    }}
                    className="w-12 text-center font-mono text-xs bg-[#071220] py-1 rounded border border-[#1e3a5f] text-cyan-300 focus:outline-none"
                  />
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

          {/* Lista de Objetos Carregados */}
          {propsList.length > 0 && (
            <div className="bg-[#0f2035] p-2.5 rounded-lg border border-[#1e3a5f] space-y-1.5">
              <label className="text-blue-300 font-semibold block">Lista de Objetos/Armas</label>
              {propsList.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPropId(p.id)}
                  className={`p-2 rounded cursor-pointer border flex justify-between items-center ${
                    selectedPropId === p.id ? 'bg-blue-600/40 border-blue-400' : 'bg-[#142843] border-transparent'
                  }`}
                >
                  <span className="font-semibold">{p.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
                    p.isAttached ? 'bg-emerald-950 border-emerald-700 text-emerald-300' : 'bg-amber-950 border-amber-700 text-amber-300'
                  }`}>
                    {p.isAttached ? `🔒 ${p.attachedBoneName}` : '✏️ Em Edição'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Controles de Edição Numérica + Botão de Fixar */}
          {selectedProp && (
            <div className="bg-[#0f2035] p-3 rounded-lg border border-[#1e3a5f] space-y-3">
              <div className="font-bold text-blue-300 border-b border-[#1e3a5f] pb-1 flex justify-between items-center">
                <span>Edição: {selectedProp.name}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  selectedProp.isAttached ? 'bg-emerald-900 text-emerald-300' : 'bg-amber-900 text-amber-300'
                }`}>
                  {selectedProp.isAttached ? 'FIXADO' : 'AJUSTANDO'}
                </span>
              </div>

              {/* Controles Numéricos com Caixas Editáveis */}
              <div className="space-y-2">

                {/* 1. TAMANHO DO OBJETO */}
                <div className="flex items-center justify-between bg-[#142843] p-1.5 rounded border border-[#1e3a5f]">
                  <span className="font-medium text-slate-200">Tamanho Objeto (%)</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateTransformDelta(selectedProp.id, 'scale', -10)}
                      className="w-7 h-7 bg-amber-600 active:bg-amber-700 font-bold rounded text-base flex items-center justify-center text-white"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={selectedProp.scale}
                      onChange={(e) => setTransformValue(selectedProp.id, 'scale', parseFloat(e.target.value) || 0)}
                      className="w-14 text-center font-mono text-xs bg-[#071220] py-1 rounded border border-[#1e3a5f] text-amber-300 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={() => updateTransformDelta(selectedProp.id, 'scale', 10)}
                      className="w-7 h-7 bg-amber-600 active:bg-amber-700 font-bold rounded text-base flex items-center justify-center text-white"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 2. Cima / Baixo */}
                <div className="flex items-center justify-between bg-[#142843] p-1.5 rounded border border-[#1e3a5f]">
                  <span className="font-medium text-slate-200">Para Cima / Baixo</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateTransformDelta(selectedProp.id, 'posY', -0.05)}
                      className="w-7 h-7 bg-rose-600 active:bg-rose-700 font-bold rounded text-base flex items-center justify-center text-white"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      step="0.05"
                      value={selectedProp.posY}
                      onChange={(e) => setTransformValue(selectedProp.id, 'posY', parseFloat(e.target.value) || 0)}
                      className="w-14 text-center font-mono text-xs bg-[#071220] py-1 rounded border border-[#1e3a5f] text-emerald-300 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => updateTransformDelta(selectedProp.id, 'posY', 0.05)}
                      className="w-7 h-7 bg-emerald-600 active:bg-emerald-700 font-bold rounded text-base flex items-center justify-center text-white"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 3. Para Esquerda / Direita */}
                <div className="flex items-center justify-between bg-[#142843] p-1.5 rounded border border-[#1e3a5f]">
                  <span className="font-medium text-slate-200">Esquerda / Direita</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateTransformDelta(selectedProp.id, 'posX', -0.05)}
                      className="w-7 h-7 bg-rose-600 active:bg-rose-700 font-bold rounded text-base flex items-center justify-center text-white"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      step="0.05"
                      value={selectedProp.posX}
                      onChange={(e) => setTransformValue(selectedProp.id, 'posX', parseFloat(e.target.value) || 0)}
                      className="w-14 text-center font-mono text-xs bg-[#071220] py-1 rounded border border-[#1e3a5f] text-emerald-300 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => updateTransformDelta(selectedProp.id, 'posX', 0.05)}
                      className="w-7 h-7 bg-emerald-600 active:bg-emerald-700 font-bold rounded text-base flex items-center justify-center text-white"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 4. Para Frente / Trás */}
                <div className="flex items-center justify-between bg-[#142843] p-1.5 rounded border border-[#1e3a5f]">
                  <span className="font-medium text-slate-200">Frente / Trás</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateTransformDelta(selectedProp.id, 'posZ', -0.05)}
                      className="w-7 h-7 bg-rose-600 active:bg-rose-700 font-bold rounded text-base flex items-center justify-center text-white"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      step="0.05"
                      value={selectedProp.posZ}
                      onChange={(e) => setTransformValue(selectedProp.id, 'posZ', parseFloat(e.target.value) || 0)}
                      className="w-14 text-center font-mono text-xs bg-[#071220] py-1 rounded border border-[#1e3a5f] text-emerald-300 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => updateTransformDelta(selectedProp.id, 'posZ', 0.05)}
                      className="w-7 h-7 bg-emerald-600 active:bg-emerald-700 font-bold rounded text-base flex items-center justify-center text-white"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 5. Rotacionar 360 Graus */}
                <div className="flex items-center justify-between bg-[#142843] p-1.5 rounded border border-[#1e3a5f]">
                  <span className="font-medium text-slate-200">Rotacionar (360°)</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateTransformDelta(selectedProp.id, 'rotY', -15)}
                      className="w-7 h-7 bg-indigo-600 active:bg-indigo-700 font-bold rounded text-xs flex items-center justify-center text-white"
                    >
                      -15°
                    </button>
                    <input
                      type="number"
                      value={selectedProp.rotY}
                      onChange={(e) => setTransformValue(selectedProp.id, 'rotY', parseFloat(e.target.value) || 0)}
                      className="w-14 text-center font-mono text-xs bg-[#071220] py-1 rounded border border-[#1e3a5f] text-indigo-300 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => updateTransformDelta(selectedProp.id, 'rotY', 15)}
                      className="w-7 h-7 bg-indigo-600 active:bg-indigo-700 font-bold rounded text-xs flex items-center justify-center text-white"
                    >
                      +15°
                    </button>
                  </div>
                </div>
              </div>

              {/* ÁREA DE FIXAÇÃO NO OSSO (SEMPRE VISÍVEL ABAIXO DOS CONTROLES) */}
              <div className="pt-3 border-t border-[#1e3a5f] space-y-2">
                {!selectedProp.isAttached ? (
                  <>
                    <label className="text-amber-300 font-semibold block text-[11px]">
                      Selecione onde fixar o objeto:
                    </label>
                    <select
                      value={targetBoneForSelect}
                      onChange={(e) => setTargetBoneForSelect(e.target.value)}
                      className="w-full bg-[#071220] border border-[#1e3a5f] rounded p-2 text-slate-200 font-medium text-xs focus:outline-none"
                    >
                      <option value="">-- Escolher Mão / Osso --</option>
                      {bones.map((b) => (
                        <option key={b.uuid} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => confirmFinalAttach(selectedProp.id)}
                      disabled={!targetBoneForSelect}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 rounded-lg font-bold text-white shadow-lg text-xs uppercase tracking-wide transition"
                    >
                      🔒 FIXAR NO PERSONAGEM
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => detachProp(selectedProp.id)}
                    className="w-full py-2.5 bg-rose-700 hover:bg-rose-600 active:bg-rose-800 rounded-lg font-bold text-white shadow text-xs transition"
                  >
                    🔓 DESFIXAR PARA EDITAR NOVAMENTE
                  </button>
                )}
              </div>

            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
