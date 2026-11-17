import React from 'react';
import { Sparkles, Sliders } from 'lucide-react';
import { ActiveTab } from '../types/rag';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  introspect: boolean;
  setIntrospect: (val: boolean | ((prev: boolean) => boolean)) => void;
  onOpenSettings: () => void;
  onCardHoverStart?: () => void;
  onCardHoverEnd?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  setActiveTab,
  introspect,
  setIntrospect,
  onOpenSettings,
  onCardHoverStart,
  onCardHoverEnd,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-black/60 backdrop-blur-2xl transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* App Title */}
          <button
            onClick={() => setActiveTab('query')}
            onMouseEnter={onCardHoverStart}
            onMouseLeave={onCardHoverEnd}
            className="text-base font-semibold tracking-wide text-white font-mono hover:text-neutral-300 transition-colors cursor-pointer"
          >
            Alpha - RAG
          </button>

          {/* Introspect & Engine Controls */}
          <div className="flex items-center gap-2.5">
            {/* Introspect Mode Control button */}
            <button
              onClick={() => setIntrospect(prev => !prev)}
              onMouseEnter={onCardHoverStart}
              onMouseLeave={onCardHoverEnd}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all duration-300 ${
                introspect
                  ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.4)]'
                  : 'bg-white/[0.03] text-neutral-300 border-white/10 hover:border-white/30 hover:bg-white/[0.06]'
              }`}
              title="Activar/desactivar el modo introspect del fondo de partículas WebGL"
            >
              <Sparkles className={`w-3.5 h-3.5 transition-transform duration-500 ${introspect ? 'rotate-180 text-black' : 'text-neutral-400 group-hover:text-white'}`} />
              <span className="hidden sm:inline font-medium tracking-tight">
                Introspect: {introspect ? 'ACTIVO' : 'AUTO'}
              </span>
              <span className={`w-2 h-2 rounded-full transition-all duration-300 ${
                introspect 
                  ? 'bg-black animate-pulse' 
                  : 'bg-white/40 group-hover:bg-white'
              }`} />
            </button>

            {/* Hyperparameters & Workspaces Config */}
            <button
              onClick={onOpenSettings}
              onMouseEnter={onCardHoverStart}
              onMouseLeave={onCardHoverEnd}
              className="p-2 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/30 text-neutral-400 hover:text-white transition-all duration-200 cursor-pointer"
              title="Configuración de Parámetros RAG y Espacios de Trabajo"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
