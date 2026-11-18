import React, { useEffect, useRef, useState } from 'react';
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
  FileText,
  KeyRound,
  ScanEye,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  ShieldCheck,
} from 'lucide-react';
import { ActiveTab } from '../types/rag';
import { ModelDefinition } from '../types/models';
import {
  DEFAULT_RUNTIME_SETTINGS,
  OcrQualityLevel,
  ProviderKeyInfo,
  RuntimeTaskSettings,
} from '../types/settings';

type SettingsSectionId =
  | 'models-tasks'
  | 'ocr-vision'
  | 'rag-engine'
  | 'workspaces'
  | 'webgl-visuals';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Navigation
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  // Models catalog & active chat model sync
  availableModels: ModelDefinition[];
  setAvailableModels: (models: ModelDefinition[]) => void;
  selectedModel: ModelDefinition;
  setSelectedModel: (model: ModelDefinition) => void;
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
  onSettingsSyncedFromModal?: (settings: RuntimeTaskSettings) => void;
  onResetDefaults: () => void;
  onRefreshBooks?: () => Promise<void> | void;
}

const SETTINGS_SECTIONS: Array<{
  id: SettingsSectionId;
  label: string;
  subtitle: string;
  icon: React.FC<{ className?: string }>;
}> = [
  {
    id: 'models-tasks',
    label: 'API Keys y Modelos',
    subtitle: 'Credenciales y modelos por tarea',
    icon: KeyRound,
  },
  {
    id: 'ocr-vision',
    label: 'OCR por Visión PDF',
    subtitle: 'Límites de páginas y calidad',
    icon: ScanEye,
  },
  {
    id: 'rag-engine',
    label: 'Motor RAG',
    subtitle: 'Top-K, temperatura y umbral',
    icon: Sliders,
  },
  {
    id: 'workspaces',
    label: 'Espacios de Trabajo',
    subtitle: 'Cambiar vista del sistema',
    icon: Layers,
  },
  {
    id: 'webgl-visuals',
    label: 'Fondo WebGL',
    subtitle: 'Simulación de partículas FBO',
    icon: Sparkles,
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  availableModels,
  setAvailableModels,
  selectedModel,
  setSelectedModel,
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
  onSettingsSyncedFromModal,
  onResetDefaults,
  onRefreshBooks,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('models-tasks');
  const [taskSettings, setTaskSettings] = useState<RuntimeTaskSettings>({
    ...DEFAULT_RUNTIME_SETTINGS,
    chatModel: selectedModel.id || ragModel,
    topK,
    temperature,
    rerankEnabled,
  });

  const [providersInfo, setProvidersInfo] = useState<{
    gemini: ProviderKeyInfo;
    nvidia: ProviderKeyInfo;
  }>({
    gemini: { configured: false, masked: '', source: 'none' },
    nvidia: { configured: false, masked: '', source: 'none' },
  });

  const [geminiInput, setGeminiInput] = useState('');
  const [nvidiaInput, setNvidiaInput] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showNvidiaKey, setShowNvidiaKey] = useState(false);
  const [clearGeminiPending, setClearGeminiPending] = useState(false);
  const [clearNvidiaPending, setClearNvidiaPending] = useState(false);

  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetectingModels, setIsDetectingModels] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const hasLoadedModalSettingsRef = useRef(false);
  const hasPendingTaskSaveRef = useRef(false);
  const latestTaskSettingsRef = useRef<RuntimeTaskSettings>(taskSettings);
  latestTaskSettingsRef.current = taskSettings;

  const flushTaskSettingsToServer = (useBeacon = false) => {
    if (!hasPendingTaskSaveRef.current) return;
    hasPendingTaskSaveRef.current = false;
    const latest = latestTaskSettingsRef.current;
    const bodyStr = JSON.stringify({
      settings: {
        chatModel: latest.chatModel,
        visionOcrModel: latest.visionOcrModel,
        webSearchModel: latest.webSearchModel,
        embeddingModel: latest.embeddingModel,
        visionOcrEnabled: latest.visionOcrEnabled,
        ocrMaxPagesPerDoc: latest.ocrMaxPagesPerDoc,
        ocrMaxFileSizeMb: latest.ocrMaxFileSizeMb,
        ocrQuality: latest.ocrQuality,
        ocrTimeoutSeconds: latest.ocrTimeoutSeconds,
        ocrStrictLatex: latest.ocrStrictLatex,
        similarityThreshold: latest.similarityThreshold,
        llmTimeoutSeconds: latest.llmTimeoutSeconds,
      },
    });

    if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        const blob = new Blob([bodyStr], { type: 'application/json' });
        if (navigator.sendBeacon('/api/settings/sync', blob)) {
          return;
        }
      } catch {}
    }

    fetch('/api/settings/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: bodyStr,
    }).catch((err) => {
      console.warn('[SettingsModal Persistence] Error guardando ajustes:', err);
    });
  };

  const updateTaskSetting = <K extends keyof RuntimeTaskSettings>(
    key: K,
    value: RuntimeTaskSettings[K]
  ) => {
    hasPendingTaskSaveRef.current = true;
    const next = { ...latestTaskSettingsRef.current, [key]: value };
    latestTaskSettingsRef.current = next;
    setTaskSettings(next);

    if (key === 'chatModel' && typeof value === 'string') {
      setRagModel(value);
      const matched = availableModels.find((m) => m.id === value);
      if (matched) {
        setSelectedModel(matched);
      }
    }
  };

  // Load persisted server settings when modal opens
  useEffect(() => {
    if (!isOpen) {
      hasLoadedModalSettingsRef.current = false;
      return;
    }
    let cancelled = false;
    hasLoadedModalSettingsRef.current = false;
    hasPendingTaskSaveRef.current = false;
    setStatusFeedback(null);
    setIsLoadingSettings(true);

    fetch('/api/settings', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.success) return;
        if (data.settings) {
          const merged: RuntimeTaskSettings = {
            ...data.settings,
            chatModel: ragModel || data.settings.chatModel,
            topK,
            temperature,
            rerankEnabled,
            particleSpeed,
            pointSize,
            vignetteDarkness,
          };
          latestTaskSettingsRef.current = merged;
          setTaskSettings(merged);
        }
        if (data.providers) {
          setProvidersInfo(data.providers);
        }
        hasLoadedModalSettingsRef.current = true;
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          hasLoadedModalSettingsRef.current = true;
          setIsLoadingSettings(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Auto-persist taskSettings edits immediately and flush on close/unmount/reload
  useEffect(() => {
    if (!isOpen || !hasLoadedModalSettingsRef.current || !hasPendingTaskSaveRef.current) return;

    const timer = setTimeout(() => {
      flushTaskSettingsToServer(false);
    }, 80);

    return () => {
      clearTimeout(timer);
    };
  }, [
    isOpen,
    taskSettings.chatModel,
    taskSettings.visionOcrModel,
    taskSettings.webSearchModel,
    taskSettings.embeddingModel,
    taskSettings.visionOcrEnabled,
    taskSettings.ocrMaxPagesPerDoc,
    taskSettings.ocrMaxFileSizeMb,
    taskSettings.ocrQuality,
    taskSettings.ocrTimeoutSeconds,
    taskSettings.ocrStrictLatex,
    taskSettings.similarityThreshold,
    taskSettings.llmTimeoutSeconds,
  ]);

  useEffect(() => {
    const handleFlush = () => {
      flushTaskSettingsToServer(true);
    };
    window.addEventListener('pagehide', handleFlush);
    window.addEventListener('beforeunload', handleFlush);
    return () => {
      window.removeEventListener('pagehide', handleFlush);
      window.removeEventListener('beforeunload', handleFlush);
      flushTaskSettingsToServer(false);
    };
  }, []);

  if (!isOpen) return null;

  const googleModels = availableModels.filter((m) => m.provider === 'google');
  const nvidiaModels = availableModels.filter((m) => m.provider === 'nvidia');

  const handleSaveSettings = async (closeAfterSave = true) => {
    hasPendingTaskSaveRef.current = false;
    setIsSaving(true);
    setStatusFeedback(null);

    try {
      const payloadSettings = {
        chatModel: taskSettings.chatModel,
        visionOcrModel: taskSettings.visionOcrModel,
        webSearchModel: taskSettings.webSearchModel,
        embeddingModel: taskSettings.embeddingModel,
        visionOcrEnabled: taskSettings.visionOcrEnabled,
        ocrMaxPagesPerDoc: taskSettings.ocrMaxPagesPerDoc,
        ocrMaxFileSizeMb: taskSettings.ocrMaxFileSizeMb,
        ocrQuality: taskSettings.ocrQuality,
        ocrTimeoutSeconds: taskSettings.ocrTimeoutSeconds,
        ocrStrictLatex: taskSettings.ocrStrictLatex,
        topK,
        temperature,
        rerankEnabled,
        similarityThreshold: taskSettings.similarityThreshold,
        llmTimeoutSeconds: taskSettings.llmTimeoutSeconds,
        particleSpeed,
        pointSize,
        vignetteDarkness,
      };

      const apiKeysPayload: Record<string, string | boolean> = {};
      if (clearGeminiPending) apiKeysPayload.clearGemini = true;
      else if (geminiInput.trim()) apiKeysPayload.geminiApiKey = geminiInput.trim();

      if (clearNvidiaPending) apiKeysPayload.clearNvidia = true;
      else if (nvidiaInput.trim()) apiKeysPayload.nvidiaApiKey = nvidiaInput.trim();

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          settings: payloadSettings,
          apiKeys: Object.keys(apiKeysPayload).length > 0 ? apiKeysPayload : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'No se pudieron guardar los ajustes');
      }

      if (data.providers) {
        setProvidersInfo(data.providers);
      }
      if (data.settings) {
        latestTaskSettingsRef.current = data.settings;
        setTaskSettings(data.settings);
        onSettingsSyncedFromModal?.(data.settings);
      }
      hasPendingTaskSaveRef.current = false;
      if (data.detection?.models && Array.isArray(data.detection.models) && data.detection.models.length > 0) {
        setAvailableModels(data.detection.models);
      }

      // Sync active chat model in workspace
      const nextModelsList: ModelDefinition[] = data.detection?.models || availableModels;
      const matchedModel = nextModelsList.find((m) => m.id === payloadSettings.chatModel);
      if (matchedModel) {
        setSelectedModel(matchedModel);
      }
      setRagModel(payloadSettings.chatModel);

      setGeminiInput('');
      setNvidiaInput('');
      setClearGeminiPending(false);
      setClearNvidiaPending(false);

      if (closeAfterSave) {
        onClose();
      } else {
        setStatusFeedback({
          type: 'success',
          message: 'Ajustes guardados y aplicados en el servidor local.',
        });
      }
    } catch (err: any) {
      setStatusFeedback({
        type: 'error',
        message: err?.message || 'Error al guardar la configuración.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshModels = async () => {
    setIsDetectingModels(true);
    setStatusFeedback(null);
    try {
      // Save any pending key first if typed
      if (geminiInput.trim() || nvidiaInput.trim()) {
        await handleSaveSettings(false);
      }
      const res = await fetch('/api/models', { cache: 'no-store' });
      const data = await res.json();
      if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
        setAvailableModels(data.models);
        setStatusFeedback({
          type: 'success',
          message: `Autodetección completada: ${data.models.length} modelos disponibles.`,
        });
      }
    } catch (err: any) {
      setStatusFeedback({
        type: 'error',
        message: err?.message || 'Error al detectar modelos.',
      });
    } finally {
      setIsDetectingModels(false);
    }
  };

  const handleResetAll = async () => {
    hasPendingTaskSaveRef.current = false;
    latestTaskSettingsRef.current = { ...DEFAULT_RUNTIME_SETTINGS };
    onResetDefaults();
    try {
      const res = await fetch('/api/settings/reset', {
        method: 'POST',
        keepalive: true,
      });
      const data = await res.json();
      if (data?.success && data.settings) {
        latestTaskSettingsRef.current = data.settings;
        setTaskSettings(data.settings);
        onSettingsSyncedFromModal?.(data.settings);
        const defaultChat = availableModels.find((m) => m.id === data.settings.chatModel);
        if (defaultChat) setSelectedModel(defaultChat);
        setRagModel(data.settings.chatModel);
      }
      if (onRefreshBooks) {
        await onRefreshBooks();
      }
    } catch {
      latestTaskSettingsRef.current = { ...DEFAULT_RUNTIME_SETTINGS };
      setTaskSettings({ ...DEFAULT_RUNTIME_SETTINGS });
    }
    hasPendingTaskSaveRef.current = false;
    setStatusFeedback({
      type: 'success',
      message: 'Valores iniciales restablecidos.',
    });
  };

  const currentSectionMeta = SETTINGS_SECTIONS.find((s) => s.id === activeSection) || SETTINGS_SECTIONS[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/35 backdrop-blur-[6px] transition-all duration-300 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[86vh] max-h-[760px] rounded-[28px] border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.18)] flex flex-col overflow-hidden select-none transition-all duration-200"
        style={{
          backgroundColor: 'rgba(14, 14, 14, 0.58)',
          backdropFilter: 'blur(26px) saturate(150%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-white">
              <Sliders className="w-4 h-4 text-neutral-200" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wide">
                Ajustes del Sistema
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono">
                {currentSectionMeta.label} · {currentSectionMeta.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ajustes"
            className="p-1.5 rounded-lg hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Two-Column Body: Left Named Submenus + Right Active Panel */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          {/* Left Submenu Navigation (visible by name) */}
          <aside className="md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-white/[0.08] bg-black/25 p-3 flex md:flex-col justify-between gap-2 overflow-x-auto md:overflow-y-auto">
            <nav className="flex md:flex-col gap-1.5 min-w-max md:min-w-0">
              <div className="hidden md:block px-2.5 pb-1 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                Submenús
              </div>
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer border shrink-0 ${
                      isActive
                        ? 'bg-white text-black border-white shadow-md shadow-white/10'
                        : 'bg-white/[0.02] text-neutral-300 border-transparent hover:bg-white/[0.07] hover:border-white/10 hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-black' : 'text-neutral-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold leading-tight whitespace-nowrap">
                        {section.label}
                      </div>
                      <div
                        className={`hidden md:block text-[10px] truncate mt-0.5 ${
                          isActive ? 'text-neutral-700' : 'text-neutral-500'
                        }`}
                      >
                        {section.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Identity Footer inside Left Sidebar */}
            <div className="hidden md:flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] mt-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.06] border border-white/15 shrink-0">
                <div className="w-3.5 h-3.5 border border-white/70 rotate-45 flex items-center justify-center">
                  <div className="w-1 h-1 bg-white rounded-full" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-white font-mono uppercase truncate">
                  Alpha - RAG
                </div>
                <div className="text-[10px] text-neutral-400 truncate">
                  F0 • Neural Localhost
                </div>
              </div>
            </div>
          </aside>

          {/* Right Content Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-6">
            {statusFeedback && (
              <div
                className={`px-3.5 py-2.5 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                  statusFeedback.type === 'success'
                    ? 'bg-white/10 border-white/25 text-white'
                    : 'bg-red-500/10 border-red-400/30 text-red-200'
                }`}
              >
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{statusFeedback.message}</span>
              </div>
            )}

            {/* SUBMENU 1: API KEYS Y MODELOS POR TAREA */}
            {activeSection === 'models-tasks' && (
              <div className="space-y-6">
                {/* Provider API Keys */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-white" />
                      <span>API Keys de Proveedores (Servidor Local)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRefreshModels}
                      disabled={isDetectingModels}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-[11px] font-mono text-neutral-200 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isDetectingModels ? 'animate-spin' : ''}`} />
                      <span>Detectar Modelos</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Las claves se guardan únicamente en el servidor local (<code className="text-neutral-200">.env.local</code>) y nunca se exponen en el navegador.
                  </p>

                  {/* Google Gemini API Key */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-white">Google AI Studio · GEMINI_API_KEY</div>
                        <div className="text-[11px] text-neutral-400">
                          Modelos Gemini, OCR por Visión y búsqueda web con Grounding
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
                          providersInfo.gemini.configured && !clearGeminiPending
                            ? 'bg-white text-black border-white font-semibold'
                            : 'bg-white/[0.05] text-neutral-400 border-white/15'
                        }`}
                      >
                        {clearGeminiPending
                          ? 'Se eliminará al guardar'
                          : providersInfo.gemini.configured
                            ? `Activa (${providersInfo.gemini.masked})`
                            : 'Sin configurar'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showGeminiKey ? 'text' : 'password'}
                          value={geminiInput}
                          onChange={(e) => {
                            setGeminiInput(e.target.value);
                            setClearGeminiPending(false);
                          }}
                          placeholder={
                            providersInfo.gemini.configured
                              ? 'Escribe una nueva clave para reemplazar la actual...'
                              : 'AIzaSy...'
                          }
                          className="w-full rounded-xl bg-black/50 border border-white/15 focus:border-white/40 px-3 py-2 pr-9 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowGeminiKey((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
                          title={showGeminiKey ? 'Ocultar' : 'Mostrar'}
                        >
                          {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      {providersInfo.gemini.configured && (
                        <button
                          type="button"
                          onClick={() => {
                            setClearGeminiPending((v) => !v);
                            setGeminiInput('');
                          }}
                          className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                            clearGeminiPending
                              ? 'bg-red-500/20 border-red-400/50 text-red-200'
                              : 'bg-white/[0.04] border-white/10 text-neutral-400 hover:text-white'
                          }`}
                          title="Eliminar clave local guardada"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* NVIDIA NIM API Key */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-white">NVIDIA NIM · NVIDIA_NIM_API_KEY</div>
                        <div className="text-[11px] text-neutral-400">
                          Opcional · Microservicios Llama 3.3, DeepSeek R1, Qwen 2.5 y Nemotron
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
                          providersInfo.nvidia.configured && !clearNvidiaPending
                            ? 'bg-white text-black border-white font-semibold'
                            : 'bg-white/[0.05] text-neutral-400 border-white/15'
                        }`}
                      >
                        {clearNvidiaPending
                          ? 'Se eliminará al guardar'
                          : providersInfo.nvidia.configured
                            ? `Activa (${providersInfo.nvidia.masked})`
                            : 'Opcional'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showNvidiaKey ? 'text' : 'password'}
                          value={nvidiaInput}
                          onChange={(e) => {
                            setNvidiaInput(e.target.value);
                            setClearNvidiaPending(false);
                          }}
                          placeholder={
                            providersInfo.nvidia.configured
                              ? 'Escribe una nueva clave para reemplazar la actual...'
                              : 'nvapi-...'
                          }
                          className="w-full rounded-xl bg-black/50 border border-white/15 focus:border-white/40 px-3 py-2 pr-9 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNvidiaKey((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
                          title={showNvidiaKey ? 'Ocultar' : 'Mostrar'}
                        >
                          {showNvidiaKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      {providersInfo.nvidia.configured && (
                        <button
                          type="button"
                          onClick={() => {
                            setClearNvidiaPending((v) => !v);
                            setNvidiaInput('');
                          }}
                          className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                            clearNvidiaPending
                              ? 'bg-red-500/20 border-red-400/50 text-red-200'
                              : 'bg-white/[0.04] border-white/10 text-neutral-400 hover:text-white'
                          }`}
                          title="Eliminar clave local guardada"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Task-Specific Models */}
                <div className="space-y-3 pt-4 border-t border-white/[0.08]">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-300">
                    <Cpu className="w-3.5 h-3.5 text-white" />
                    <span>Modelos Asignados por Tarea</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 1. Modelo de Chat */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                      <label className="block text-xs font-semibold text-white">
                        1.- Modelo de Chat (Síntesis)
                      </label>
                      <p className="text-[11px] text-neutral-400">
                        Modelo principal para responder consultas y razonamiento técnico.
                      </p>
                      <select
                        value={taskSettings.chatModel}
                        onChange={(e) => updateTaskSetting('chatModel', e.target.value)}
                        disabled={isLoadingSettings}
                        className="w-full rounded-xl bg-black/60 border border-white/15 focus:border-white/40 px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                      >
                        {googleModels.length > 0 && (
                          <optgroup label="Google AI Studio">
                            {googleModels.map((m) => (
                              <option key={m.id} value={m.id} className="bg-neutral-900 text-white">
                                {m.name} ({m.id})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {nvidiaModels.length > 0 && (
                          <optgroup label="NVIDIA NIM Microservices">
                            {nvidiaModels.map((m) => (
                              <option key={m.id} value={m.id} className="bg-neutral-900 text-white">
                                {m.name} ({m.id})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {/* 2. Modelo OCR por Visión */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                      <label className="block text-xs font-semibold text-white">
                        2.- Modelo OCR por Visión
                      </label>
                      <p className="text-[11px] text-neutral-400">
                        Fallback para páginas escaneadas (Gemini: máx. 14 págs/min · NVIDIA: máx. 38 págs/min).
                      </p>
                      <select
                        value={taskSettings.visionOcrModel}
                        onChange={(e) => updateTaskSetting('visionOcrModel', e.target.value)}
                        disabled={isLoadingSettings}
                        className="w-full rounded-xl bg-black/60 border border-white/15 focus:border-white/40 px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                      >
                        {googleModels.length > 0 && (
                          <optgroup label="Google AI Studio (Máx. 14 págs/min)">
                            {googleModels.map((m) => (
                              <option key={m.id} value={m.id} className="bg-neutral-900 text-white">
                                {m.name} ({m.id})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {nvidiaModels.length > 0 && (
                          <optgroup label="NVIDIA NIM Visión / OCR (Máx. 38 págs/min)">
                            {nvidiaModels
                              .filter((m) => m.supportsVision !== false)
                              .map((m) => (
                                <option key={m.id} value={m.id} className="bg-neutral-900 text-white">
                                  {m.name} ({m.id})
                                </option>
                              ))}
                          </optgroup>
                        )}
                      </select>
                      <div className="text-[10px] font-mono text-neutral-300 pt-0.5">
                        {(() => {
                          const selectedOcr = availableModels.find((m) => m.id === taskSettings.visionOcrModel);
                          const isNvidia =
                            selectedOcr?.provider === 'nvidia' ||
                            taskSettings.visionOcrModel.includes('/') ||
                            taskSettings.visionOcrModel.startsWith('nvidia') ||
                            taskSettings.visionOcrModel.startsWith('meta') ||
                            taskSettings.visionOcrModel.startsWith('qwen');
                          return isNvidia
                            ? 'Límite activo: NVIDIA NIM — máx. 38 páginas/minuto (solo páginas escaneadas)'
                            : 'Límite activo: Google Gemini — máx. 14 páginas/minuto (solo páginas escaneadas)';
                        })()}
                      </div>
                    </div>

                    {/* 3. Modelo de Búsqueda Web */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                      <label className="block text-xs font-semibold text-white">
                        3.- Modelo de Búsqueda Web
                      </label>
                      <p className="text-[11px] text-neutral-400">
                        Sintetiza resultados cuando el alcance es Web (con Grounding).
                      </p>
                      <select
                        value={taskSettings.webSearchModel}
                        onChange={(e) => updateTaskSetting('webSearchModel', e.target.value)}
                        disabled={isLoadingSettings}
                        className="w-full rounded-xl bg-black/60 border border-white/15 focus:border-white/40 px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                      >
                        <option value="auto" className="bg-neutral-900 text-white">
                          Automático (usar modelo de chat activo)
                        </option>
                        {googleModels.map((m) => (
                          <option key={m.id} value={m.id} className="bg-neutral-900 text-white">
                            {m.name} ({m.id})
                          </option>
                        ))}
                        {nvidiaModels.map((m) => (
                          <option key={m.id} value={m.id} className="bg-neutral-900 text-white">
                            {m.name} ({m.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 4. Modelo de Embeddings / Indexación */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                      <label className="block text-xs font-semibold text-white">
                        4.- Modelo de Embeddings
                      </label>
                      <p className="text-[11px] text-neutral-400">
                        Perfil vectorial asignado al indexar fragmentos en /libreria.
                      </p>
                      <select
                        value={taskSettings.embeddingModel}
                        onChange={(e) => updateTaskSetting('embeddingModel', e.target.value)}
                        disabled={isLoadingSettings}
                        className="w-full rounded-xl bg-black/60 border border-white/15 focus:border-white/40 px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                      >
                        <option value="text-embedding-004" className="bg-neutral-900 text-white">
                          Google text-embedding-004 (768-D)
                        </option>
                        <option value="gemini-embedding-001 (3072-D)" className="bg-neutral-900 text-white">
                          Google gemini-embedding-001 (3072-D)
                        </option>
                        <option value="nvidia/nv-embedqa-e5-v5 (1024-D)" className="bg-neutral-900 text-white">
                          NVIDIA nv-embedqa-e5-v5 (1024-D)
                        </option>
                        <option value="local-bm25-lexical" className="bg-neutral-900 text-white">
                          Local BM25 + Léxico Técnico (Offline)
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUBMENU 2: OCR POR VISIÓN Y LÍMITES DE EXTRACCIÓN */}
            {activeSection === 'ocr-vision' && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-300">
                  <ScanEye className="w-3.5 h-3.5 text-white" />
                  <span>Políticas y Límites de Extracción con Visión OCR</span>
                </div>

                {/* Enable Vision OCR */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-white">
                      Activar Fallback OCR por Visión en Páginas Escaneadas
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      La extracción inicia en Python por página; solo las páginas sin texto real usan OCR con{' '}
                      <code className="text-neutral-200">{taskSettings.visionOcrModel}</code>.
                    </div>
                    <div className="text-[10px] font-mono text-neutral-300">
                      {taskSettings.visionOcrModel.includes('/')
                        ? 'Límite de tasa activo (NVIDIA NIM): máximo 38 páginas / minuto'
                        : 'Límite de tasa activo (Google Gemini): máximo 14 páginas / minuto'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateTaskSetting('visionOcrEnabled', !taskSettings.visionOcrEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ml-3 ${
                      taskSettings.visionOcrEnabled ? 'bg-white' : 'bg-neutral-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full transition-transform absolute top-1 ${
                        taskSettings.visionOcrEnabled ? 'bg-black translate-x-6' : 'bg-neutral-500 translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Max Pages Extracted with Vision OCR */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-neutral-200 font-semibold">
                      Límite de páginas extraídas con Visión OCR:
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white text-black font-semibold">
                      {taskSettings.ocrMaxPagesPerDoc === 0
                        ? 'Sin límite'
                        : `${taskSettings.ocrMaxPagesPerDoc} págs / PDF`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    step="5"
                    value={taskSettings.ocrMaxPagesPerDoc}
                    onChange={(e) => updateTaskSetting('ocrMaxPagesPerDoc', parseInt(e.target.value, 10))}
                    className="w-full accent-white cursor-pointer"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                    <span className="text-neutral-500">0 = Sin límite · Recomendado 25–50 págs para optimizar tokens y latencia</span>
                    <div className="flex items-center gap-1">
                      {[10, 25, 50, 100, 0].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => updateTaskSetting('ocrMaxPagesPerDoc', preset)}
                          className={`px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                            taskSettings.ocrMaxPagesPerDoc === preset
                              ? 'bg-white text-black border-white font-semibold'
                              : 'bg-white/[0.04] text-neutral-400 border-white/10 hover:text-white'
                          }`}
                        >
                          {preset === 0 ? 'Ilimitado' : `${preset}p`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Max File Size MB */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-neutral-200">Tamaño máximo de PDF para envío a Visión OCR:</span>
                    <span className="text-white font-semibold">{taskSettings.ocrMaxFileSizeMb} MB</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="50"
                    step="1"
                    value={taskSettings.ocrMaxFileSizeMb}
                    onChange={(e) => updateTaskSetting('ocrMaxFileSizeMb', parseInt(e.target.value, 10))}
                    className="w-full accent-white cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-neutral-500">
                    <span>2 MB</span>
                    <span>18 MB (estándar)</span>
                    <span>50 MB</span>
                  </div>
                </div>

                {/* OCR Quality Mode */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                  <div className="text-xs font-semibold text-white">
                    Nivel de Precisión / Detalle OCR Visión
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'fast', label: 'Rápido', desc: 'Menor latencia' },
                        { id: 'balanced', label: 'Equilibrado', desc: 'Fórmulas y texto' },
                        { id: 'high', label: 'Alta Precisión', desc: 'Tablas y subíndices' },
                      ] as Array<{ id: OcrQualityLevel; label: string; desc: string }>
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateTaskSetting('ocrQuality', opt.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          taskSettings.ocrQuality === opt.id
                            ? 'bg-white text-black border-white font-semibold'
                            : 'bg-white/[0.02] text-neutral-300 border-white/10 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="text-xs font-semibold">{opt.label}</div>
                        <div
                          className={`text-[10px] ${
                            taskSettings.ocrQuality === opt.id ? 'text-neutral-700' : 'text-neutral-500'
                          }`}
                        >
                          {opt.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* OCR Timeout + Strict LaTeX */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-neutral-300">Timeout OCR:</span>
                      <span className="text-white font-semibold">{taskSettings.ocrTimeoutSeconds}s</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="180"
                      step="5"
                      value={taskSettings.ocrTimeoutSeconds}
                      onChange={(e) => updateTaskSetting('ocrTimeoutSeconds', parseInt(e.target.value, 10))}
                      className="w-full accent-white cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <div>
                      <div className="text-xs font-medium text-white">LaTeX Estricto</div>
                      <div className="text-[11px] text-neutral-400">Fórmulas en $...$ y $$...$$</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateTaskSetting('ocrStrictLatex', !taskSettings.ocrStrictLatex)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                        taskSettings.ocrStrictLatex ? 'bg-white' : 'bg-neutral-800'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full transition-transform absolute top-1 ${
                          taskSettings.ocrStrictLatex ? 'bg-black translate-x-6' : 'bg-neutral-500 translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SUBMENU 3: MOTOR RAG E HIPERPARÁMETROS */}
            {activeSection === 'rag-engine' && (
              <div className="space-y-5">
                <div className="text-xs font-mono uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-white" />
                  <span>Parámetros de Recuperación e Inferencia RAG</span>
                </div>

                {/* Top-K Chunks slider */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-neutral-200">Top-K Chunks Recuperados:</span>
                    <span className="text-white font-semibold">{topK} fragmentos</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    value={topK}
                    onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                    className="w-full accent-white cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-neutral-500">
                    <span>1 chunk</span>
                    <span>5 (óptimo)</span>
                    <span>12 chunks</span>
                  </div>
                </div>

                {/* Temperature */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-neutral-200">Temperatura (Creatividad vs Precisión):</span>
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

                {/* Similarity Threshold & LLM Timeout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-neutral-300">Umbral Similitud:</span>
                      <span className="text-white font-semibold">
                        {(taskSettings.similarityThreshold * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.95"
                      step="0.05"
                      value={taskSettings.similarityThreshold}
                      onChange={(e) =>
                        updateTaskSetting('similarityThreshold', parseFloat(e.target.value))
                      }
                      className="w-full accent-white cursor-pointer"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-neutral-300">Timeout Inferencia:</span>
                      <span className="text-white font-semibold">{taskSettings.llmTimeoutSeconds}s</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="120"
                      step="5"
                      value={taskSettings.llmTimeoutSeconds}
                      onChange={(e) =>
                        updateTaskSetting('llmTimeoutSeconds', parseInt(e.target.value, 10))
                      }
                      className="w-full accent-white cursor-pointer"
                    />
                  </div>
                </div>

                {/* Reranker Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/10">
                  <div>
                    <div className="text-xs font-semibold text-white">Reranking con Cross-Encoder</div>
                    <div className="text-[11px] text-neutral-400">
                      Reordena semánticamente los Top-K fragmentos locales antes de sintetizar
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRerankEnabled(!rerankEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      rerankEnabled ? 'bg-white' : 'bg-neutral-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full transition-transform absolute top-1 ${
                        rerankEnabled ? 'bg-black translate-x-6' : 'bg-neutral-500 translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* SUBMENU 4: ESPACIOS DE TRABAJO */}
            {activeSection === 'workspaces' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-neutral-300">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-white" />
                    <span>Espacios de Trabajo & Navegación</span>
                  </div>
                  <span className="text-[10px] text-neutral-500">Haz clic para cambiar de vista</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      id: 'query',
                      label: 'Consultas RAG',
                      desc: 'Chat interactivo y síntesis con citas verificadas',
                      icon: MessageSquareText,
                    },
                    {
                      id: 'vectors',
                      label: 'Espacio Vectorial',
                      desc: 'Proyección 2D t-SNE de embeddings locales',
                      icon: Database,
                    },
                    {
                      id: 'documents',
                      label: 'Documentos PDF',
                      desc: 'Corpus en /libreria, ingestión y chunking',
                      icon: FileText,
                    },
                    {
                      id: 'pipeline',
                      label: 'Pipeline & Topología',
                      desc: 'Arquitectura completa de recuperación híbrida',
                      icon: Cpu,
                    },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isSelected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab.id as ActiveTab);
                          onClose();
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all duration-200 group flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                            : 'bg-white/[0.03] text-neutral-300 border-white/10 hover:border-white/30 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-black text-white'
                              : 'bg-white/[0.05] border border-white/10 text-white'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold">{tab.label}</div>
                            {isSelected && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black text-white font-medium">
                                ACTIVO
                              </span>
                            )}
                          </div>
                          <div
                            className={`text-[11px] mt-0.5 ${
                              isSelected ? 'text-neutral-700' : 'text-neutral-400'
                            }`}
                          >
                            {tab.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SUBMENU 5: FONDO WEBGL */}
            {activeSection === 'webgl-visuals' && (
              <div className="space-y-5">
                <div className="text-xs font-mono uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  <span>Fondo WebGL (Simulación de Partículas FBO)</span>
                </div>

                {/* Speed slider */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-neutral-200">Velocidad del Ruido:</span>
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
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-neutral-200">Tamaño de Partículas:</span>
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
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-neutral-200">Intensidad de Viñeta:</span>
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
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-white/[0.08] bg-black/25 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleResetAll}
            className="flex items-center gap-1.5 text-xs font-mono text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer Valores Iniciales</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSaveSettings(false)}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Aplicar'}
            </button>
            <button
              type="button"
              onClick={() => handleSaveSettings(true)}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors cursor-pointer shadow-lg disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar y Cerrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
