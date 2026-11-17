import React from 'react';
import { 
  X, 
  Sliders, 
  Cpu, 
  Sparkles, 
  Database, 
  Layers, 
  RotateCcw,
  Check,
  MessageSquareText,
  FileText
} from 'lucide-react';
import { ActiveTab } from '../types/rag';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Navigation
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  // RAG params
  ragModel: string;
  setRagModel: (m: string) => void;
  topK: number;
  setTopK: (k: number) => void;
  temperature: number;
  setTemperature: (t: number) => void;
  rerankEnabled: boolean;
  setRerankEnabled: (v: boolean) => void;
  // Background params
  particleSpeed: number;
  setParticleSpeed: (s: number) => void;
  pointSize: number;
  setPointSize: (p: number) => void;
  vignetteDarkness: number;
  setVignetteDarkness: (v: number) => void;
  onResetDefaults: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  ragModel,
  setRagModel,
  topK,
  setTopK,
  temperature,
  setTemperature,
  rerankEnabled,
  setRerankEnabled,
  particleSpeed,
  setParticleSpeed,
  pointSize,
  setPointSize,
  vignetteDarkness,
  setVignetteDarkness,
  onResetDefaults,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/25 backdrop-blur-[6px] transition-all duration-300 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl rounded-[28px] border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.18)] p-6 space-y-6 max-h-[90vh] overflow-y-auto select-none transition-all duration-200"
        style={{
          backgroundColor: 'rgba(15, 15, 15, 0.40)',
          backdropFilter: 'blur(24px) saturate(150%)',
          WebkitBackdropFilter: 'blur(24px) saturate(150%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-white">
              <Sliders className="w-4 h-4 text-neutral-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wide">
                Configuración del Sistema RAG & Espacios
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono">
                Navegación de espacios de trabajo, hiperparámetros y simulación
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* App Identity Banner */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.05] border border-white/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] shrink-0">
            <div className="w-4 h-4 border border-white/60 rotate-45 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-wider text-white uppercase font-mono">
                Alpha - RAG
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-neutral-300">
                F0 • Neural
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-sans">
              PDF Neural Intelligence & Vector Embeddings
            </p>
          </div>
        </div>

        {/* Workspace Navigation Tabs (Moved from Header) */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-neutral-400">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-white" />
              <span>Espacios de Trabajo & Navegación</span>
            </div>
            <span className="text-[10px] text-neutral-500">Selecciona para cambiar vista</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { id: 'query', label: 'Consultas RAG', desc: 'Chat interactivo y síntesis con citas', icon: MessageSquareText },
              { id: 'vectors', label: 'Espacio Vectorial', desc: 'Proyección 2D t-SNE de embeddings', icon: Database },
              { id: 'documents', label: 'Documentos PDF', desc: 'Corpus, ingestión y chunking', icon: FileText },
              { id: 'pipeline', label: 'Pipeline & Topología', desc: 'Flujo completo de extremo a extremo', icon: Cpu },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as ActiveTab);
                    onClose();
                  }}
                  className={`p-3 rounded-xl border text-left transition-all duration-200 group flex items-start gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                      : 'bg-white/[0.03] text-neutral-300 border-white/10 hover:border-white/30 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-black text-white' : 'bg-white/[0.05] border border-white/10 text-white'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold">{tab.label}</div>
                      {isSelected && (
                        <span className="text-[9px] font-mono px-1 rounded bg-black text-white font-medium">ACTIVO</span>
                      )}
                    </div>
                    <div className={`text-[10px] truncate ${isSelected ? 'text-neutral-700' : 'text-neutral-400'}`}>
                      {tab.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 1: RAG Engine Hyperparameters */}
        <div className="space-y-4 pt-2 border-t border-white/[0.08]">
          <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-white" />
            <span>Parámetros del Motor RAG</span>
          </div>

          {/* Model selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-neutral-300">Modelo de Síntesis Principal:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRagModel('gemini-3.8-flash')}
                className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                  ragModel === 'gemini-3.8-flash'
                    ? 'bg-white text-black font-semibold border-white'
                    : 'bg-white/[0.03] text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                <div className="font-semibold">Gemini 3.8 Flash</div>
                <div className={`text-[10px] ${ragModel === 'gemini-3.8-flash' ? 'text-neutral-700' : 'text-neutral-500'}`}>Google AI · Baja latencia</div>
              </button>

              <button
                type="button"
                onClick={() => setRagModel('gemini-4-argon')}
                className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                  ragModel === 'gemini-4-argon'
                    ? 'bg-white text-black font-semibold border-white'
                    : 'bg-white/[0.03] text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                <div className="font-semibold">Gemini 4 Argon</div>
                <div className={`text-[10px] ${ragModel === 'gemini-4-argon' ? 'text-neutral-700' : 'text-neutral-500'}`}>Google AI · Razonamiento STEM</div>
              </button>

              <button
                type="button"
                onClick={() => setRagModel('meta/llama-3.3-70b-instruct')}
                className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                  ragModel === 'meta/llama-3.3-70b-instruct'
                    ? 'bg-white text-black font-semibold border-white'
                    : 'bg-white/[0.03] text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                <div className="font-semibold">Llama 3.3 70B</div>
                <div className={`text-[10px] ${ragModel === 'meta/llama-3.3-70b-instruct' ? 'text-neutral-700' : 'text-neutral-500'}`}>NVIDIA NIM · TensorRT</div>
              </button>

              <button
                type="button"
                onClick={() => setRagModel('deepseek-ai/deepseek-r1')}
                className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                  ragModel === 'deepseek-ai/deepseek-r1'
                    ? 'bg-white text-black font-semibold border-white'
                    : 'bg-white/[0.03] text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                <div className="font-semibold">DeepSeek R1</div>
                <div className={`text-[10px] ${ragModel === 'deepseek-ai/deepseek-r1' ? 'text-neutral-700' : 'text-neutral-500'}`}>NVIDIA NIM · Razonamiento profundo</div>
              </button>
            </div>
          </div>

          {/* Top-K Chunks slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-neutral-300">Top-K Chunks Recuperados:</span>
              <span className="text-white font-semibold">{topK} fragmentos</span>
            </div>
            <input
              type="range"
              min="1"
              max="12"
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value))}
              className="w-full accent-white cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-neutral-500">
              <span>1 chunk</span>
              <span>5 (óptimo)</span>
              <span>12 chunks</span>
            </div>
          </div>

          {/* Temperature */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-neutral-300">Temperatura (Creatividad vs Hechos):</span>
              <span className="text-white font-semibold">{temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-white cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-neutral-500">
              <span>0.0 (Determinista)</span>
              <span>0.1 (Factual RAG)</span>
              <span>1.0 (Creativo)</span>
            </div>
          </div>

          {/* Reranker Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10">
            <div>
              <div className="text-xs font-medium text-white">Reranking con Cross-Encoder</div>
              <div className="text-[11px] text-neutral-400">Reordena semánticamente los Top-K candidatos</div>
            </div>
            <button
              onClick={() => setRerankEnabled(!rerankEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                rerankEnabled ? 'bg-white' : 'bg-neutral-800'
              }`}
            >
              <div className={`w-4 h-4 rounded-full transition-transform absolute top-1 ${
                rerankEnabled ? 'bg-black translate-x-6' : 'bg-neutral-500 translate-x-1'
              }`} />
            </button>
          </div>
        </div>

        {/* Section 2: WebGL Background Simulation Parameters */}
        <div className="space-y-4 pt-4 border-t border-white/[0.08]">
          <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>Fondo WebGL (Simulación de Partículas FBO)</span>
          </div>

          {/* Speed slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-neutral-300">Velocidad del Ruido:</span>
              <span className="text-white font-semibold">{particleSpeed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2.5"
              step="0.1"
              value={particleSpeed}
              onChange={(e) => setParticleSpeed(parseFloat(e.target.value))}
              className="w-full accent-white cursor-pointer"
            />
          </div>

          {/* Point size */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-neutral-300">Tamaño de Partículas:</span>
              <span className="text-white font-semibold">{pointSize.toFixed(1)}px</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="20.0"
              step="1.0"
              value={pointSize}
              onChange={(e) => setPointSize(parseFloat(e.target.value))}
              className="w-full accent-white cursor-pointer"
            />
          </div>

          {/* Vignette Darkness */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-neutral-300">Intensidad de Viñeta:</span>
              <span className="text-white font-semibold">{vignetteDarkness.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={vignetteDarkness}
              onChange={(e) => setVignetteDarkness(parseFloat(e.target.value))}
              className="w-full accent-white cursor-pointer"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between">
          <button
            onClick={onResetDefaults}
            className="flex items-center gap-1.5 text-xs font-mono text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer Valores Iniciales</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white text-black text-xs font-medium hover:bg-neutral-200 transition-colors cursor-pointer shadow-lg"
          >
            Guardar y Aplicar
          </button>
        </div>

      </div>
    </div>
  );
};
