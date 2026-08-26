import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function App() {
  // Estados de transformação
  const [posX, setPosX] = useState<number>(0);
  const [posY, setPosY] = useState<number>(0);
  const [posZ, setPosZ] = useState<number>(0);
  const [rotY, setRotY] = useState<number>(0);
  
  // Estado de anexação
  const [isAttached, setIsAttached] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('Objeto pronto para edição');

  // Incrementos
  const stepPos = 0.1;
  const stepRot = 15; // graus

  // Funções de ajuste numérico (Posição)
  const adjustValue = (setter: React.Dispatch<React.SetStateAction<number>>, current: number, delta: number) => {
    setter(parseFloat((current + delta).toFixed(2)));
  };

  // Funções de ajuste numérico (Rotação 360)
  const adjustRotation = (delta: number) => {
    setRotY((prev) => {
      let newRot = (prev + delta) % 360;
      if (newRot < 0) newRot += 360;
      return newRot;
    });
  };

  // Alternar fixação no personagem
  const toggleAttach = () => {
    setIsAttached(!isAttached);
    if (!isAttached) {
      setStatusMsg('Objeto FIXADO na mão/membro do personagem!');
    } else {
      setStatusMsg('Objeto DESFIXADO (Edição livre)');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#071220] text-white font-sans overflow-hidden">
      {/* Área da Viewport 3D */}
      <div className="flex-1 relative bg-black">
        <div id="canvas-container" className="w-full h-full">
          {/* O Canvas do Three.js é montado aqui */}
        </div>
        
        {/* Banner de Status */}
        <div className="absolute top-3 left-3 right-3 bg-slate-900/80 backdrop-blur border border-slate-700 p-2 rounded-lg text-center text-xs text-cyan-400">
          {statusMsg}
        </div>
      </div>

      {/* Painel de Controles Otimizado para Celular */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 space-y-4 max-h-[50vh] overflow-y-auto">
        
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider text-center border-b border-slate-800 pb-2">
          Ajustes do Objeto
        </h2>

        {/* 1. Mover para Cima / Baixo */}
        <div className="flex items-center justify-between bg-slate-800/60 p-2 rounded-lg">
          <span className="text-sm font-medium">Cima / Baixo</span>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => adjustValue(setPosY, posY, -stepPos)}
              className="w-10 h-10 bg-rose-600 active:bg-rose-700 text-white font-bold rounded-lg text-lg flex items-center justify-center shadow"
            >
              -
            </button>
            <span className="w-14 text-center font-mono text-sm bg-slate-950 py-1 rounded border border-slate-700">
              {posY.toFixed(1)}
            </span>
            <button
              onClick={() => adjustValue(setPosY, posY, stepPos)}
              className="w-10 h-10 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-lg text-lg flex items-center justify-center shadow"
            >
              +
            </button>
          </div>
        </div>

        {/* 2. Mover para Esquerda / Direita */}
        <div className="flex items-center justify-between bg-slate-800/60 p-2 rounded-lg">
          <span className="text-sm font-medium">Esquerda / Direita</span>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => adjustValue(setPosX, posX, -stepPos)}
              className="w-10 h-10 bg-rose-600 active:bg-rose-700 text-white font-bold rounded-lg text-lg flex items-center justify-center shadow"
            >
              -
            </button>
            <span className="w-14 text-center font-mono text-sm bg-slate-950 py-1 rounded border border-slate-700">
              {posX.toFixed(1)}
            </span>
            <button
              onClick={() => adjustValue(setPosX, posX, stepPos)}
              className="w-10 h-10 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-lg text-lg flex items-center justify-center shadow"
            >
              +
            </button>
          </div>
        </div>

        {/* 3. Mover para Frente / Trás */}
        <div className="flex items-center justify-between bg-slate-800/60 p-2 rounded-lg">
          <span className="text-sm font-medium">Frente / Trás</span>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => adjustValue(setPosZ, posZ, -stepPos)}
              className="w-10 h-10 bg-rose-600 active:bg-rose-700 text-white font-bold rounded-lg text-lg flex items-center justify-center shadow"
            >
              -
            </button>
            <span className="w-14 text-center font-mono text-sm bg-slate-950 py-1 rounded border border-slate-700">
              {posZ.toFixed(1)}
            </span>
            <button
              onClick={() => adjustValue(setPosZ, posZ, stepPos)}
              className="w-10 h-10 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-lg text-lg flex items-center justify-center shadow"
            >
              +
            </button>
          </div>
        </div>

        {/* 4. Rotacionar 360 Graus */}
        <div className="flex items-center justify-between bg-slate-800/60 p-2 rounded-lg">
          <span className="text-sm font-medium">Girar (360°)</span>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => adjustRotation(-stepRot)}
              className="w-10 h-10 bg-indigo-600 active:bg-indigo-700 text-white font-bold rounded-lg text-sm flex items-center justify-center shadow"
            >
              -{stepRot}°
            </button>
            <span className="w-14 text-center font-mono text-sm bg-slate-950 py-1 rounded border border-slate-700">
              {rotY}°
            </span>
            <button
              onClick={() => adjustRotation(stepRot)}
              className="w-10 h-10 bg-indigo-600 active:bg-indigo-700 text-white font-bold rounded-lg text-sm flex items-center justify-center shadow"
            >
              +{stepRot}°
            </button>
          </div>
        </div>

        {/* Botão de Fixar no Personagem */}
        <div className="pt-2">
          <button
            onClick={toggleAttach}
            className={`w-full py-3 px-4 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 ${
              isAttached
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            }`}
          >
            <span>{isAttached ? '🔒 Armamento Fixado' : '🔓 Fixar no Personagem'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
