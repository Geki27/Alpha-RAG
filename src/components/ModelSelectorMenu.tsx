import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Brain, 
  Check, 
  RotateCw, 
  Settings, 
  X, 
  Sparkles, 
  Cpu, 
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';
import { 
  ModelDefinition, 
  ModelProvider,
  EffortLevel, 
  EFFORT_SHORT_LABELS, 
  AVAILABLE_MODELS 
} from '../types/models';

interface ProviderInfo {
  active: boolean;
  authenticated: boolean;
  label: string;
  status: string;
  detectedCount?: number;
}

interface ModelSelectorMenuProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: ModelDefinition;
  onSelectModel: (model: ModelDefinition) => void;
  thinkingEnabled: boolean;
  onToggleThinking: (enabled: boolean) => void;
  effortLevel: EffortLevel;
  onSelectEffort: (effort: EffortLevel) => void;
  models?: ModelDefinition[];
  onModelsDetected?: (models: ModelDefinition[]) => void;
}

const EFFORT_OPTIONS: Array<{ level: EffortLevel; label: string }> = [
  { level: 'minimal', label: 'Minimal' },
  { level: 'low', label: 'Low' },
  { level: 'medium', label: 'Medium' },
  { level: 'high', label: 'High' },
  { level: 'max', label: 'Max' },
];

export const ModelSelectorMenu: React.FC<ModelSelectorMenuProps> = ({
  isOpen,
  onClose,
  selectedModel,
  onSelectModel,
  thinkingEnabled,
  onToggleThinking,
  effortLevel,
  onSelectEffort,
  models: initialModels = AVAILABLE_MODELS,
  onModelsDetected,
}) => {
  const [activeModels, setActiveModels] = useState<ModelDefinition[]>(initialModels);
  const [providerFilter, setProviderFilter] = useState<'all' | ModelProvider>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSubView, setActiveSubView] = useState<'menu' | 'edit'>('menu');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [providersStatus, setProvidersStatus] = useState<{
    google?: ProviderInfo;
    nvidia?: ProviderInfo;
  }>({});

  // Auto-detect models from backend /api/models on mount or when opening menu
  const fetchDetectedModels = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.models) && data.models.length > 0) {
          setActiveModels(data.models);
          if (onModelsDetected) {
            onModelsDetected(data.models);
          }
        }
        if (data.providers) {
          setProvidersStatus(data.providers);
        }
        setFeedbackMessage(`Modelos autodetectados (${data.totalDetected || data.models?.length || 0}): Google AI & NVIDIA NIM activos.`);
        setTimeout(() => setFeedbackMessage(null), 3500);
      }
    } catch (e) {
      console.warn('Error en autodetección de modelos:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDetectedModels();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Compute model counts per provider
  const googleCount = activeModels.filter(m => m.provider === 'google').length;
  const nvidiaCount = activeModels.filter(m => m.provider === 'nvidia').length;

  // Filter models based on search input and provider filter
  const filteredModels = activeModels.filter((m) => {
    if (providerFilter !== 'all' && m.provider !== providerFilter) return false;

    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      m.name.toLowerCase().includes(query) ||
      m.providerLabel.toLowerCase().includes(query) ||
      m.id.toLowerCase().includes(query) ||
      m.provider.toLowerCase().includes(query)
    );
  });

  const handleRefresh = async () => {
    setFeedbackMessage('Auto-detectando modelos disponibles en Google AI y NVIDIA NIM...');
    await fetchDetectedModels();
  };

  const currentEffortBadge = EFFORT_SHORT_LABELS[effortLevel] || 'Med';

  return (
    <div
      className="absolute bottom-full mb-2.5 right-0 sm:right-[116px] w-[420px] sm:w-[470px] max-w-[calc(100vw-24px)] h-[435px] rounded-[22px] border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.18)] overflow-hidden transition-all duration-200 z-50 select-none animate-in fade-in zoom-in-95 flex flex-col justify-between"
      style={{
        backgroundColor: 'rgba(15, 15, 15, 0.40)',
        backdropFilter: 'blur(24px) saturate(150%)',
        WebkitBackdropFilter: 'blur(24px) saturate(150%)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {activeSubView === 'edit' ? (
        /* SUBVIEW: EDIT MODELS & PROVIDER STATUS */
        <div className="p-4 space-y-3.5 h-full flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
            <button
              type="button"
              onClick={() => setActiveSubView('menu')}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver</span>
            </button>
            <h3 className="text-xs font-bold font-sans uppercase tracking-wider text-white flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-neutral-300" />
              <span>Estado de Proveedores Autodetectados</span>
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 text-xs font-sans overflow-y-auto flex-1 pr-1">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Google AI Studio</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>{googleCount} detectados</span>
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                {providersStatus.google?.status || 'Modelos Gemini 3.8 Flash, 3.5 Pro, 4 Argon, 3.1 Flash Lite y Nano Banana.'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>NVIDIA NIM Microservices</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>{nvidiaCount} detectados</span>
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                {providersStatus.nvidia?.status || 'Aceleración por TensorRT-LLM: Llama 3.3 70B, DeepSeek R1, Mistral NeMo y Qwen 2.5.'}
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-between items-center border-t border-white/[0.08]">
            <span className="text-[10px] font-mono text-neutral-400">Total: {activeModels.length} modelos en catálogo</span>
            <button
              type="button"
              onClick={() => setActiveSubView('menu')}
              className="px-3 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              Aceptar
            </button>
          </div>
        </div>
      ) : (
        /* MAIN MENU: TWO-COLUMN LAYOUT MATCHING USER SCREENSHOT */
        <div className="p-3.5 h-full flex flex-col justify-between">
          {/* Optional feedback banner */}
          {feedbackMessage && (
            <div className="mb-2 px-3 py-1 rounded-xl bg-white/[0.06] border border-white/12 text-neutral-200 text-[10px] font-sans flex items-center justify-between animate-fade-in shrink-0">
              <span className="truncate pr-2">{feedbackMessage}</span>
              <button 
                type="button" 
                onClick={() => setFeedbackMessage(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex gap-3 flex-1 min-h-0">
            {/* LEFT COLUMN: PROVIDER TABS + SEARCH + MODEL CARDS LIST + FOOTER */}
            <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
              <div className="space-y-2 flex-1 min-h-0 flex flex-col">
                
                {/* Provider Filter Tabs */}
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
                  <button
                    type="button"
                    onClick={() => setProviderFilter('all')}
                    className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-medium transition-all ${
                      providerFilter === 'all'
                        ? 'bg-white/15 text-white font-semibold shadow-xs'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Todos ({activeModels.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setProviderFilter('google')}
                    className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-medium transition-all flex items-center justify-center gap-1 ${
                      providerFilter === 'google'
                        ? 'bg-amber-500/20 text-amber-200 font-semibold border border-amber-500/30'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                    <span>Google ({googleCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProviderFilter('nvidia')}
                    className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-medium transition-all flex items-center justify-center gap-1 ${
                      providerFilter === 'nvidia'
                        ? 'bg-emerald-500/20 text-emerald-200 font-semibold border border-emerald-500/30'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <Cpu className="w-2.5 h-2.5 text-emerald-400" />
                    <span>NVIDIA ({nvidiaCount})</span>
                  </button>
                </div>

                {/* Search Input Box */}
                <div className="relative shrink-0">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar modelos autodetectados..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/40 font-sans transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Model Cards Scroll List */}
                <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin">
                  {filteredModels.length === 0 ? (
                    <div className="text-center py-6 text-xs text-neutral-500 font-sans italic">
                      No se encontraron modelos coincidentes
                    </div>
                  ) : (
                    filteredModels.map((model) => {
                      const isSelected = selectedModel.id === model.id;
                      const isNvidia = model.provider === 'nvidia';
                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            onSelectModel(model);
                          }}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all duration-150 cursor-pointer group flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-white/[0.08] border-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                              : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-xs font-sans tracking-tight">
                                {model.name}
                              </span>
                              {isNvidia ? (
                                <span className="text-[8px] font-mono uppercase px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                  NIM
                                </span>
                              ) : (
                                <span className="text-[8px] font-mono uppercase px-1 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                  Google
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-neutral-400 truncate font-sans mt-0.5">
                              {model.providerLabel}
                            </div>
                          </div>

                          {/* Right effort pill badge */}
                          <div className="shrink-0">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.08] text-neutral-300 border border-white/10 group-hover:border-white/20 transition-colors">
                              {currentEffortBadge}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Bottom footer buttons */}
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/[0.08] text-[11px] font-sans">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer group"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-white' : 'group-hover:rotate-45 transition-transform'}`} />
                  <span>Autodetectar Modelos</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubView('edit')}
                  className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Proveedores...</span>
                </button>
              </div>
            </div>

            {/* VERTICAL DIVIDER */}
            <div className="w-[1px] bg-white/[0.08] self-stretch my-0.5" />

            {/* RIGHT COLUMN: OPTIONS + EFFORT LIST */}
            <div className="w-[130px] sm:w-[145px] shrink-0 flex flex-col justify-between">
              <div>
                {/* Section: OPTIONS */}
                <div className="space-y-1.5">
                  <div className="text-[9px] font-mono tracking-widest text-neutral-400 uppercase font-semibold">
                    OPTIONS
                  </div>

                  {/* Thinking Toggle Switch */}
                  <div 
                    onClick={() => onToggleThinking(!thinkingEnabled)}
                    className="p-2 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/[0.06] transition-colors"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-white font-medium">
                      <Brain className="w-3.5 h-3.5 text-neutral-300" />
                      <span>Thinking</span>
                    </div>

                    {/* Switch pill */}
                    <div
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 relative ${
                        thinkingEnabled ? 'bg-white' : 'bg-neutral-800'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full transition-transform duration-200 shadow-sm ${
                          thinkingEnabled
                            ? 'bg-black translate-x-4'
                            : 'bg-neutral-400 translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Section: EFFORT */}
                <div className="space-y-1 mt-4">
                  <div className="text-[9px] font-mono tracking-widest text-neutral-400 uppercase font-semibold">
                    EFFORT
                  </div>

                  <div className="space-y-0.5">
                    {EFFORT_OPTIONS.map((item) => {
                      const isSelected = effortLevel === item.level;
                      return (
                        <button
                          key={item.level}
                          type="button"
                          onClick={() => onSelectEffort(item.level)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-sans transition-all duration-150 cursor-pointer text-left ${
                            isSelected
                              ? 'bg-white/[0.08] border border-white/20 text-white font-bold shadow-xs'
                              : 'text-neutral-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                          }`}
                        >
                          <span>{item.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Provider Quick Indicator at bottom */}
              <div className="pt-2 border-t border-white/[0.08] text-[9px] font-mono text-neutral-400 truncate">
                <span>Motor: </span>
                <span className="text-white font-medium">
                  {selectedModel.provider === 'nvidia' ? 'NVIDIA NIM' : 'Google AI'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

