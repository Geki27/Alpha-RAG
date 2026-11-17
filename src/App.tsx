/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import { Sparkles, Sliders } from 'lucide-react';
import { ParticleBackground } from './components/background';
import { QueryWorkspace } from './components/QueryWorkspace';
import { ConversationSidebar } from './components/ConversationSidebar';
import { ActiveTab, RagMessage, GroundedCitation, ChunkItem, ChatSession, DocumentSource } from './types/rag';

const VectorVisualizer = lazy(() =>
  import('./components/VectorVisualizer').then((m) => ({ default: m.VectorVisualizer }))
);
const DocumentLibrary = lazy(() =>
  import('./components/DocumentLibrary').then((m) => ({ default: m.DocumentLibrary }))
);
const PipelineArchitecture = lazy(() =>
  import('./components/PipelineArchitecture').then((m) => ({ default: m.PipelineArchitecture }))
);
const ContextInspectorModal = lazy(() =>
  import('./components/ContextInspectorModal').then((m) => ({ default: m.ContextInspectorModal }))
);
const PdfPreviewModal = lazy(() =>
  import('./components/PdfPreviewModal').then((m) => ({ default: m.PdfPreviewModal }))
);
const SettingsModal = lazy(() =>
  import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const IndexedLibraryModal = lazy(() =>
  import('./components/IndexedLibraryModal').then((m) => ({ default: m.IndexedLibraryModal }))
);
import { INITIAL_SESSIONS } from './data/mockRagData';
import { ModelDefinition, EffortLevel, AVAILABLE_MODELS } from './types/models';
import { ChunkStrategyType, RuntimeTaskSettings } from './types/settings';
import { SearchScope } from './components/AttachmentMenu';

const UI_PREFS_STORAGE_KEY = 'aether_ui_prefs_v1';

interface StoredUiPrefs {
  particleSpeed?: number;
  pointSize?: number;
  vignetteDarkness?: number;
  lockedIntrospect?: boolean;
  thinkingEnabled?: boolean;
  effortLevel?: EffortLevel;
  searchScope?: SearchScope;
  chatModel?: string;
  topK?: number;
  temperature?: number;
  rerankEnabled?: boolean;
  hideExamples?: boolean;
  chunkStrategy?: ChunkStrategyType;
  chunkSize?: number;
  chunkOverlap?: number;
  uploadDiscipline?: string;
  activeDiscipline?: string;
}

function readStoredUiPrefs(): StoredUiPrefs {
  try {
    const raw = localStorage.getItem(UI_PREFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredUiPrefs(prefs: StoredUiPrefs): void {
  try {
    localStorage.setItem(UI_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>('query');

  // Sidebar & Sessions State
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('aether_rag_sessions_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading stored sessions', e);
    }
    return INITIAL_SESSIONS;
  });

  const initialUiPrefsRef = useRef<StoredUiPrefs | null>(null);
  if (initialUiPrefsRef.current === null) {
    initialUiPrefsRef.current = readStoredUiPrefs();
  }
  const initialUiPrefs = initialUiPrefsRef.current;

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem('aether_rag_active_session_id_v1');
      if (savedId && sessions.some(s => s.id === savedId)) return savedId;
    } catch (e) {}
    return sessions[0]?.id || INITIAL_SESSIONS[0]?.id || 'session-1';
  });

  // Save sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('aether_rag_sessions_v1', JSON.stringify(sessions));
    } catch (e) {}
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem('aether_rag_active_session_id_v1', activeSessionId);
    } catch (e) {}
  }, [activeSessionId]);

  // Introspect State (cloned from skal-ventures-template)
  // When introspect is active or card is hovered, particles illuminate and sparkle
  const [lockedIntrospect, setLockedIntrospect] = useState<boolean>(
    typeof initialUiPrefs.lockedIntrospect === 'boolean' ? initialUiPrefs.lockedIntrospect : false
  );
  const [hoverIntrospect, setHoverIntrospect] = useState<boolean>(false);

  // Background WebGL Tunables
  const [particleSpeed, setParticleSpeed] = useState<number>(
    typeof initialUiPrefs.particleSpeed === 'number' ? initialUiPrefs.particleSpeed : 1.0
  );
  const [pointSize, setPointSize] = useState<number>(
    typeof initialUiPrefs.pointSize === 'number' ? initialUiPrefs.pointSize : 10.0
  );
  const [vignetteDarkness, setVignetteDarkness] = useState<number>(
    typeof initialUiPrefs.vignetteDarkness === 'number' ? initialUiPrefs.vignetteDarkness : 1.5
  );
  const [aperture] = useState<number>(1.79);
  const [focus] = useState<number>(3.8);

  // RAG Engine Tunables & Dynamic Models Auto-detection
  const [availableModels, setAvailableModels] = useState<ModelDefinition[]>(AVAILABLE_MODELS);
  const [selectedModel, setSelectedModel] = useState<ModelDefinition>(() => {
    const savedModelId = initialUiPrefs.chatModel;
    return AVAILABLE_MODELS.find(m => m.id === savedModelId) || AVAILABLE_MODELS[0];
  });
  const [thinkingEnabled, setThinkingEnabled] = useState<boolean>(
    typeof initialUiPrefs.thinkingEnabled === 'boolean' ? initialUiPrefs.thinkingEnabled : true
  );
  const [effortLevel, setEffortLevel] = useState<EffortLevel>(
    initialUiPrefs.effortLevel || 'medium'
  );
  const [searchScope, setSearchScope] = useState<SearchScope>(
    initialUiPrefs.searchScope || 'local'
  );
  const [ragModel, setRagModel] = useState<string>(initialUiPrefs.chatModel || 'gemini-2.5-flash');
  const [topK, setTopK] = useState<number>(
    typeof initialUiPrefs.topK === 'number' ? initialUiPrefs.topK : 5
  );
  const [temperature, setTemperature] = useState<number>(
    typeof initialUiPrefs.temperature === 'number' ? initialUiPrefs.temperature : 0.1
  );
  const [rerankEnabled, setRerankEnabled] = useState<boolean>(
    typeof initialUiPrefs.rerankEnabled === 'boolean' ? initialUiPrefs.rerankEnabled : true
  );
  const [hideExamples, setHideExamples] = useState<boolean>(
    typeof initialUiPrefs.hideExamples === 'boolean' ? initialUiPrefs.hideExamples : false
  );
  const [chunkStrategy, setChunkStrategy] = useState<ChunkStrategyType>(
    initialUiPrefs.chunkStrategy || 'semantic'
  );
  const [chunkSize, setChunkSize] = useState<number>(
    typeof initialUiPrefs.chunkSize === 'number' ? initialUiPrefs.chunkSize : 512
  );
  const [chunkOverlap, setChunkOverlap] = useState<number>(
    typeof initialUiPrefs.chunkOverlap === 'number' ? initialUiPrefs.chunkOverlap : 64
  );
  const [uploadDiscipline, setUploadDiscipline] = useState<string>(
    initialUiPrefs.uploadDiscipline || 'Estatica'
  );
  const [activeDiscipline, setActiveDiscipline] = useState<string>(
    initialUiPrefs.activeDiscipline || 'ALL'
  );

  const dirtyFieldsRef = useRef<Set<keyof RuntimeTaskSettings>>(new Set());
  const hasPendingWorkspaceSaveRef = useRef<boolean>(false);
  const availableModelsRef = useRef<ModelDefinition[]>(availableModels);
  availableModelsRef.current = availableModels;
  const ragModelRef = useRef<string>(ragModel);
  ragModelRef.current = ragModel;

  const markSettingDirty = useCallback((...fields: Array<keyof RuntimeTaskSettings>) => {
    fields.forEach((f) => dirtyFieldsRef.current.add(f));
    hasPendingWorkspaceSaveRef.current = true;
  }, []);

  const handleSetParticleSpeed = useCallback((v: number) => {
    markSettingDirty('particleSpeed');
    setParticleSpeed(v);
  }, [markSettingDirty]);

  const handleSetPointSize = useCallback((v: number) => {
    markSettingDirty('pointSize');
    setPointSize(v);
  }, [markSettingDirty]);

  const handleSetVignetteDarkness = useCallback((v: number) => {
    markSettingDirty('vignetteDarkness');
    setVignetteDarkness(v);
  }, [markSettingDirty]);

  const handleSetTopK = useCallback((v: number) => {
    markSettingDirty('topK');
    setTopK(v);
  }, [markSettingDirty]);

  const handleSetTemperature = useCallback((v: number) => {
    markSettingDirty('temperature');
    setTemperature(v);
  }, [markSettingDirty]);

  const handleSetRerankEnabled = useCallback((v: boolean) => {
    markSettingDirty('rerankEnabled');
    setRerankEnabled(v);
  }, [markSettingDirty]);

  const handleSetThinkingEnabled = useCallback((v: React.SetStateAction<boolean>) => {
    markSettingDirty('thinkingEnabled');
    setThinkingEnabled(v);
  }, [markSettingDirty]);

  const handleSetEffortLevel = useCallback((v: EffortLevel) => {
    markSettingDirty('effortLevel');
    setEffortLevel(v);
  }, [markSettingDirty]);

  const handleSetSearchScope = useCallback((v: SearchScope) => {
    markSettingDirty('searchScope');
    setSearchScope(v);
  }, [markSettingDirty]);

  const handleSetSelectedModel = useCallback((model: ModelDefinition) => {
    markSettingDirty('chatModel');
    setSelectedModel(model);
    setRagModel(model.id);
  }, [markSettingDirty]);

  const handleSetChunkStrategy = useCallback((v: ChunkStrategyType) => {
    markSettingDirty('chunkStrategy');
    setChunkStrategy(v);
  }, [markSettingDirty]);

  const handleSetChunkSize = useCallback((v: number) => {
    markSettingDirty('chunkSize');
    setChunkSize(v);
  }, [markSettingDirty]);

  const handleSetChunkOverlap = useCallback((v: number) => {
    markSettingDirty('chunkOverlap');
    setChunkOverlap(v);
  }, [markSettingDirty]);

  const handleSetUploadDiscipline = useCallback((v: string) => {
    markSettingDirty('uploadDiscipline');
    setUploadDiscipline(v);
  }, [markSettingDirty]);

  const handleSetActiveDiscipline = useCallback((v: string) => {
    markSettingDirty('activeDiscipline');
    setActiveDiscipline(v);
  }, [markSettingDirty]);

  const latestWorkspacePayloadRef = useRef<Partial<RuntimeTaskSettings>>({});
  latestWorkspacePayloadRef.current = {
    chatModel: ragModel,
    topK,
    temperature,
    rerankEnabled,
    particleSpeed,
    pointSize,
    vignetteDarkness,
    lockedIntrospect,
    thinkingEnabled,
    effortLevel,
    searchScope,
    chunkStrategy,
    chunkSize,
    chunkOverlap,
    uploadDiscipline,
    activeDiscipline,
  };

  const flushWorkspaceSettingsToServer = useCallback(() => {
    if (!hasPendingWorkspaceSaveRef.current) return;
    hasPendingWorkspaceSaveRef.current = false;
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        settings: latestWorkspacePayloadRef.current,
      }),
    }).catch(() => {});
  }, []);

  // Hydrate persisted server settings immediately (fast local disk read, decoupled from external /api/models)
  useEffect(() => {
    let cancelled = false;

    fetch('/api/settings', { cache: 'no-store' })
      .then((res) => res.json())
      .then((settingsData) => {
        if (cancelled) return;
        const dirty = dirtyFieldsRef.current;

        if (settingsData?.success && settingsData.settings) {
          const s = settingsData.settings as RuntimeTaskSettings;
          if (!dirty.has('topK') && typeof s.topK === 'number') setTopK(s.topK);
          if (!dirty.has('temperature') && typeof s.temperature === 'number') setTemperature(s.temperature);
          if (!dirty.has('rerankEnabled') && typeof s.rerankEnabled === 'boolean') setRerankEnabled(s.rerankEnabled);
          if (!dirty.has('particleSpeed') && typeof s.particleSpeed === 'number') setParticleSpeed(s.particleSpeed);
          if (!dirty.has('pointSize') && typeof s.pointSize === 'number') setPointSize(s.pointSize);
          if (!dirty.has('vignetteDarkness') && typeof s.vignetteDarkness === 'number') setVignetteDarkness(s.vignetteDarkness);
          if (!dirty.has('lockedIntrospect') && typeof s.lockedIntrospect === 'boolean') setLockedIntrospect(s.lockedIntrospect);
          if (!dirty.has('thinkingEnabled') && typeof s.thinkingEnabled === 'boolean') setThinkingEnabled(s.thinkingEnabled);
          if (!dirty.has('effortLevel') && typeof s.effortLevel === 'string') setEffortLevel(s.effortLevel as EffortLevel);
          if (!dirty.has('searchScope') && typeof s.searchScope === 'string') setSearchScope(s.searchScope as SearchScope);
          if (!dirty.has('hideExamples') && typeof s.hideExamples === 'boolean') setHideExamples(s.hideExamples);
          if (!dirty.has('chunkStrategy') && typeof s.chunkStrategy === 'string') setChunkStrategy(s.chunkStrategy as ChunkStrategyType);
          if (!dirty.has('chunkSize') && typeof s.chunkSize === 'number') setChunkSize(s.chunkSize);
          if (!dirty.has('chunkOverlap') && typeof s.chunkOverlap === 'number') setChunkOverlap(s.chunkOverlap);
          if (!dirty.has('uploadDiscipline') && typeof s.uploadDiscipline === 'string') setUploadDiscipline(s.uploadDiscipline);
          if (!dirty.has('activeDiscipline') && typeof s.activeDiscipline === 'string') setActiveDiscipline(s.activeDiscipline);
          if (!dirty.has('chatModel') && typeof s.chatModel === 'string' && s.chatModel) {
            setRagModel(s.chatModel);
            const matched = availableModelsRef.current.find((m) => m.id === s.chatModel);
            if (matched) setSelectedModel(matched);
          }
        }
      })
      .catch(() => {});

    // Auto-detect models independently without blocking settings hydration
    fetch('/api/models', { cache: 'no-store' })
      .then((res) => res.json())
      .then((modelsData) => {
        if (cancelled) return;
        const modelsList: ModelDefinition[] =
          modelsData && Array.isArray(modelsData.models) && modelsData.models.length > 0
            ? modelsData.models
            : AVAILABLE_MODELS;

        setAvailableModels(modelsList);
        const currentChatId = ragModelRef.current;
        const matched = modelsList.find((m) => m.id === currentChatId);
        if (matched) {
          setSelectedModel(matched);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror UI preferences synchronously to localStorage on every change
  useEffect(() => {
    writeStoredUiPrefs({
      chatModel: ragModel,
      topK,
      temperature,
      rerankEnabled,
      particleSpeed,
      pointSize,
      vignetteDarkness,
      lockedIntrospect,
      thinkingEnabled,
      effortLevel,
      searchScope,
      hideExamples,
      chunkStrategy,
      chunkSize,
      chunkOverlap,
      uploadDiscipline,
      activeDiscipline,
    });
  }, [
    ragModel,
    topK,
    temperature,
    rerankEnabled,
    particleSpeed,
    pointSize,
    vignetteDarkness,
    lockedIntrospect,
    thinkingEnabled,
    effortLevel,
    searchScope,
    hideExamples,
    chunkStrategy,
    chunkSize,
    chunkOverlap,
    uploadDiscipline,
    activeDiscipline,
  ]);

  // Auto-persist user-modified workspace, RAG, library & WebGL background settings to server disk
  useEffect(() => {
    if (!hasPendingWorkspaceSaveRef.current) return;

    const timer = setTimeout(() => {
      flushWorkspaceSettingsToServer();
    }, 120);

    return () => clearTimeout(timer);
  }, [
    ragModel,
    topK,
    temperature,
    rerankEnabled,
    particleSpeed,
    pointSize,
    vignetteDarkness,
    lockedIntrospect,
    thinkingEnabled,
    effortLevel,
    searchScope,
    chunkStrategy,
    chunkSize,
    chunkOverlap,
    uploadDiscipline,
    activeDiscipline,
    flushWorkspaceSettingsToServer,
  ]);

  // Flush any unsent settings change immediately on tab reload / close
  useEffect(() => {
    const handleFlush = () => {
      flushWorkspaceSettingsToServer();
    };
    window.addEventListener('pagehide', handleFlush);
    window.addEventListener('beforeunload', handleFlush);
    return () => {
      window.removeEventListener('pagehide', handleFlush);
      window.removeEventListener('beforeunload', handleFlush);
    };
  }, [flushWorkspaceSettingsToServer]);

  // Generating State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Modals State
  const [selectedCitation, setSelectedCitation] = useState<GroundedCitation | null>(null);
  const [selectedChunk, setSelectedChunk] = useState<ChunkItem | null>(null);
  const [isContextModalOpen, setIsContextModalOpen] = useState<boolean>(false);

  const [pdfPreviewDoc, setPdfPreviewDoc] = useState<string>('Ingenieria Mecanica Estatica - R C Hibbeler 12ma Ed.pdf');
  const [pdfPreviewPage, setPdfPreviewPage] = useState<number>(142);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState<boolean>(false);

  // Documents Library State (synchronized with physical /libreria/ disk storage)
  const [documents, setDocuments] = useState<DocumentSource[]>([]);

  const refreshLibraryBooks = useCallback(async () => {
    try {
      const response = await fetch('/api/library/books', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (typeof data.hideExamples === 'boolean' && !dirtyFieldsRef.current.has('hideExamples')) {
        setHideExamples(data.hideExamples);
      }
      if (data.success && Array.isArray(data.books)) {
        const mappedDocs: DocumentSource[] = data.books.map((b: any) => ({
          id: b.bookId,
          name: b.title || b.fileName,
          title: b.title || b.fileName,
          fileName: b.fileName,
          pages: b.pages || 1,
          chunksCount: b.chunksCount || 1,
          size: b.size || '—',
          uploadDate: b.createdAt || 'Registrado',
          status: b.status || 'indexed',
          author: b.author || 'Documento PDF Indexado',
          category: (b.discipline || 'Estatica').replace(/_/g, ' '),
          vectorModel: 'text-embedding-004 (768-dim)',
          isExample: Boolean(b.isExample),
          discipline: b.discipline,
          physicalPaths: {
            pdf: b.pdfPath,
            vector: b.vectorPath,
            txt: b.txtPath
          }
        }));
        setDocuments(mappedDocs);
      }
    } catch (err) {
      console.error('Error cargando biblioteca física desde /api/library/books:', err);
    }
  }, []);

  const handleToggleHideExamples = useCallback(async (nextHide: boolean) => {
    markSettingDirty('hideExamples');
    setHideExamples(nextHide);
    try {
      if (nextHide) {
        await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({ settings: { hideExamples: true } }),
        });
      } else {
        await fetch('/api/library/examples/restore', {
          method: 'POST',
          keepalive: true,
        });
      }
    } catch (err) {
      console.error('Error actualizando visibilidad de ejemplos:', err);
    }
    await refreshLibraryBooks();
  }, [markSettingDirty, refreshLibraryBooks]);

  useEffect(() => {
    refreshLibraryBooks();
  }, [refreshLibraryBooks]);

  // Hover handlers for dynamic introspect reaction
  const handleCardHoverStart = useCallback(() => {
    setHoverIntrospect(true);
  }, []);

  const handleCardHoverEnd = useCallback(() => {
    setHoverIntrospect(false);
  }, []);

  // Compute effective introspect state for WebGL canvas
  const isIntrospectActive = lockedIntrospect || hoverIntrospect;

  // Handlers for session management
  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleCreateSession = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: `Conversación ${sessions.length + 1}`,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      updatedAt: 'Ahora',
      messages: [],
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
  };

  const handleRenameSession = (sessionId: string, newTitle: string) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle, updatedAt: 'Ahora' } : s));
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        if (filtered.length > 0) {
          setActiveSessionId(filtered[0].id);
        } else {
          const freshId = `session-${Date.now()}`;
          const freshSession: ChatSession = {
            id: freshId,
            title: 'Nueva Conversación',
            createdAt: 'Ahora',
            updatedAt: 'Ahora',
            messages: [],
          };
          setActiveSessionId(freshId);
          return [freshSession];
        }
      }
      return filtered;
    });
  };

  const handleClearAllSessions = () => {
    const freshId = `session-${Date.now()}`;
    const freshSession: ChatSession = {
      id: freshId,
      title: 'Nueva Consulta',
      createdAt: 'Ahora',
      updatedAt: 'Ahora',
      messages: [],
    };
    setSessions([freshSession]);
    setActiveSessionId(freshId);
  };

  // Active Session & Messages
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const activeMessages = activeSession?.messages || [];

  // Handle user query submission with realistic RAG pipeline synthesis
  const handleSendMessage = async (userQuery: string, scope?: SearchScope) => {
    const effectiveScope = scope || searchScope;
    const userMsg: RagMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: userQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Update active session messages immediately
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const isGenericTitle = s.title.startsWith('Conversación') || s.title === 'Nueva Conversación' || s.messages.length === 0;
        const newTitle = isGenericTitle 
          ? userQuery.replace(/[*#`_]/g, '').trim().slice(0, 34) 
          : s.title;

        return {
          ...s,
          title: newTitle || s.title,
          updatedAt: 'Ahora',
          messages: [...s.messages, userMsg],
        };
      }
      return s;
    }));

    setIsGenerating(true);
    setHoverIntrospect(true);

    try {
      const response = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userQuery,
          scope: effectiveScope,
          modelId: selectedModel.id,
          provider: selectedModel.provider,
          thinking: thinkingEnabled,
          effort: effortLevel,
          topK,
          temperature,
          rerankEnabled
        })
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data && data.success && data.content) {
        const botMsg: RagMessage = {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: data.content,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          citations: data.citations || [],
          metrics: data.metrics,
        };

        setSessions(prev => prev.map(s => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              updatedAt: 'Ahora',
              messages: [...s.messages, botMsg],
            };
          }
          return s;
        }));
      } else {
        const errorDetail = data?.error || (response.ok ? 'El modelo no devolvió contenido.' : `Error HTTP ${response.status}: Error en el servidor de inferencia.`);
        const isModelUnavail = errorDetail.includes('410') || errorDetail.includes('end of life') || errorDetail.includes('404') || errorDetail.includes('not found') || errorDetail.includes('503') || errorDetail.includes('high demand') || errorDetail.includes('429') || errorDetail.includes('quota');

        const botMsg: RagMessage = {
          id: `bot-err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Error en la inferencia del modelo (${selectedModel.name} · ${selectedModel.provider === 'nvidia' ? 'NVIDIA NIM' : 'Google AI'}):**\n\n> ${errorDetail}\n\n${isModelUnavail ? '*Sugerencia: El modelo seleccionado presenta restricciones de cuota, fin de ciclo (EOL) o sobrecarga. Te recomendamos seleccionar **Gemini 2.5 Flash** (activo y verificado) en el menú de modelos.*' : '*Verifica los parámetros o selecciona otro modelo.*'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          citations: data?.citations || [],
          metrics: data?.metrics,
        };

        setSessions(prev => prev.map(s => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              updatedAt: 'Ahora',
              messages: [...s.messages, botMsg],
            };
          }
          return s;
        }));
      }
    } catch (err: any) {
      console.error('Error al consultar /api/rag/query:', err);
      const botMsg: RagMessage = {
        id: `bot-net-err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Error de conexión con el servidor:**\n\n> ${err?.message || String(err)}\n\n*Por favor verifica que la conexión siga activa y reintenta.*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: 'Ahora',
            messages: [...s.messages, botMsg],
          };
        }
        return s;
      }));
    } finally {
      setIsGenerating(false);
      setHoverIntrospect(false);
    }
  };

  // Handlers for citations and PDF preview
  const handleSelectCitation = (citation: GroundedCitation) => {
    setSelectedCitation(citation);
    setSelectedChunk(null);
    setIsContextModalOpen(true);
  };

  const handleSelectChunk = (chunk: ChunkItem) => {
    setSelectedChunk(chunk);
    setSelectedCitation(null);
    setIsContextModalOpen(true);
  };

  const handleOpenPdf = (docName: string, page: number) => {
    setPdfPreviewDoc(docName);
    setPdfPreviewPage(page);
    setIsPdfModalOpen(true);
  };

  const handleResetDefaults = useCallback(() => {
    dirtyFieldsRef.current.clear();
    hasPendingWorkspaceSaveRef.current = false;
    setParticleSpeed(1.0);
    setPointSize(10.0);
    setVignetteDarkness(1.5);
    setLockedIntrospect(false);
    setThinkingEnabled(true);
    setEffortLevel('medium');
    setSearchScope('local');
    setTopK(5);
    setTemperature(0.1);
    setRerankEnabled(true);
    setHideExamples(false);
    setChunkStrategy('semantic');
    setChunkSize(512);
    setChunkOverlap(64);
    setUploadDiscipline('Estatica');
    setActiveDiscipline('ALL');
    const defaultModel = availableModels.find((m) => m.id === 'gemini-2.5-flash') || AVAILABLE_MODELS[0];
    setSelectedModel(defaultModel);
    setRagModel(defaultModel.id);
    try {
      localStorage.removeItem(UI_PREFS_STORAGE_KEY);
    } catch {}
  }, [availableModels]);

  return (
    <div className="relative min-h-screen w-full bg-black text-white selection:bg-white selection:text-black">
      
      {/* WebGL Particle Background cloned from skal-ventures-template with Introspect Function */}
      <ParticleBackground
        hovering={isIntrospectActive}
        speed={particleSpeed}
        focus={focus}
        aperture={aperture}
        pointSize={pointSize}
        vignetteDarkness={vignetteDarkness}
      />

      {/* Main Glassmorphic Layout Structure */}
      <div className="relative z-10 flex flex-col min-h-screen">
        

        {/* Floating Minimal Controls (Settings & Introspect) */}
        <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
          <button
            onClick={() => {
              markSettingDirty('lockedIntrospect');
              setLockedIntrospect(prev => !prev);
            }}
            onMouseEnter={handleCardHoverStart}
            onMouseLeave={handleCardHoverEnd}
            className={`p-2.5 rounded-xl border text-xs font-mono transition-all duration-300 backdrop-blur-xl cursor-pointer ${
              lockedIntrospect
                ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.4)]'
                : 'bg-black/40 text-neutral-400 border-white/10 hover:border-white/30 hover:text-white hover:bg-black/60'
            }`}
            title="Modo Introspect (Partículas WebGL)"
          >
            <Sparkles className={`w-4 h-4 transition-transform duration-500 ${lockedIntrospect ? 'rotate-180 text-black' : ''}`} />
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            onMouseEnter={handleCardHoverStart}
            onMouseLeave={handleCardHoverEnd}
            className="p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-white/30 text-neutral-400 hover:text-white transition-all duration-200 backdrop-blur-xl cursor-pointer shadow-lg shadow-black/40"
            title="Ajustes y Espacios de Trabajo"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic View Router with fluid workspace offset on sidebar open */}
        <main className={`flex-1 transition-all duration-300 ease-out ${
          isSidebarOpen ? 'md:pl-[340px]' : 'pl-0'
        } ${activeTab === 'query' ? 'pb-0 overflow-hidden' : 'pb-16 pt-16'}`}>
          {activeTab === 'query' && (
            <QueryWorkspace
              messages={activeMessages}
              onSendMessage={handleSendMessage}
              isGenerating={isGenerating}
              onSelectCitation={handleSelectCitation}
              onOpenPdfPreview={handleOpenPdf}
              onCardHoverStart={handleCardHoverStart}
              onCardHoverEnd={handleCardHoverEnd}
              isSidebarOpen={isSidebarOpen}
              documents={documents}
              selectedModel={selectedModel}
              setSelectedModel={handleSetSelectedModel}
              thinkingEnabled={thinkingEnabled}
              setThinkingEnabled={handleSetThinkingEnabled}
              effortLevel={effortLevel}
              setEffortLevel={handleSetEffortLevel}
              searchScope={searchScope}
              setSearchScope={handleSetSearchScope}
              availableModels={availableModels}
              setAvailableModels={setAvailableModels}
            />
          )}

          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[50vh] text-xs font-mono text-neutral-400">
                Cargando módulo...
              </div>
            }
          >
            {activeTab === 'vectors' && (
              <VectorVisualizer
                onSelectChunk={handleSelectChunk}
                onOpenPdf={handleOpenPdf}
                onCardHoverStart={handleCardHoverStart}
                onCardHoverEnd={handleCardHoverEnd}
              />
            )}

            {activeTab === 'documents' && (
              <DocumentLibrary
                onOpenPdf={handleOpenPdf}
                onCardHoverStart={handleCardHoverStart}
                onCardHoverEnd={handleCardHoverEnd}
                documents={documents}
                setDocuments={setDocuments}
                onRefreshBooks={refreshLibraryBooks}
                onOpenLibraryModal={() => setIsLibraryModalOpen(true)}
                chunkStrategy={chunkStrategy}
                onChangeChunkStrategy={handleSetChunkStrategy}
                chunkSize={chunkSize}
                onChangeChunkSize={handleSetChunkSize}
                chunkOverlap={chunkOverlap}
                onChangeChunkOverlap={handleSetChunkOverlap}
                uploadDiscipline={uploadDiscipline}
                onChangeUploadDiscipline={handleSetUploadDiscipline}
              />
            )}

            {activeTab === 'pipeline' && (
              <PipelineArchitecture
                onCardHoverStart={handleCardHoverStart}
                onCardHoverEnd={handleCardHoverEnd}
              />
            )}
          </Suspense>
        </main>
      </div>

      {/* Collapsible Conversation Sessions Sidebar */}
      <ConversationSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(prev => !prev)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onCreateSession={handleCreateSession}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        onClearAllSessions={handleClearAllSessions}
        onOpenLibrary={() => setIsLibraryModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        documentCount={documents.length}
        onCardHoverStart={handleCardHoverStart}
        onCardHoverEnd={handleCardHoverEnd}
      />

      {/* Modals & Slide-Overs (lazy-mounted on demand) */}
      <Suspense fallback={null}>
        {isContextModalOpen && (
          <ContextInspectorModal
            citation={selectedCitation}
            chunk={selectedChunk}
            isOpen={isContextModalOpen}
            onClose={() => setIsContextModalOpen(false)}
            onOpenPdf={handleOpenPdf}
          />
        )}

        {isPdfModalOpen && (
          <PdfPreviewModal
            isOpen={isPdfModalOpen}
            onClose={() => setIsPdfModalOpen(false)}
            documentName={pdfPreviewDoc}
            initialPage={pdfPreviewPage}
          />
        )}

        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            availableModels={availableModels}
            setAvailableModels={setAvailableModels}
            selectedModel={selectedModel}
            setSelectedModel={handleSetSelectedModel}
            ragModel={ragModel}
            setRagModel={setRagModel}
            topK={topK}
            setTopK={handleSetTopK}
            temperature={temperature}
            setTemperature={handleSetTemperature}
            rerankEnabled={rerankEnabled}
            setRerankEnabled={handleSetRerankEnabled}
            particleSpeed={particleSpeed}
            setParticleSpeed={handleSetParticleSpeed}
            pointSize={pointSize}
            setPointSize={handleSetPointSize}
            vignetteDarkness={vignetteDarkness}
            setVignetteDarkness={handleSetVignetteDarkness}
            onResetDefaults={handleResetDefaults}
            onRefreshBooks={refreshLibraryBooks}
          />
        )}

        {isLibraryModalOpen && (
          <IndexedLibraryModal
            isOpen={isLibraryModalOpen}
            onClose={() => setIsLibraryModalOpen(false)}
            onOpenPdf={handleOpenPdf}
            onInspectChunk={handleSelectChunk}
            documents={documents}
            setDocuments={setDocuments}
            onRefreshBooks={refreshLibraryBooks}
            hideExamples={hideExamples}
            onToggleHideExamples={handleToggleHideExamples}
            chunkStrategy={chunkStrategy}
            onChangeChunkStrategy={handleSetChunkStrategy}
            chunkSize={chunkSize}
            onChangeChunkSize={handleSetChunkSize}
            chunkOverlap={chunkOverlap}
            onChangeChunkOverlap={handleSetChunkOverlap}
            uploadDiscipline={uploadDiscipline}
            onChangeUploadDiscipline={handleSetUploadDiscipline}
            activeDiscipline={activeDiscipline}
            onChangeActiveDiscipline={handleSetActiveDiscipline}
            onCardHoverStart={handleCardHoverStart}
            onCardHoverEnd={handleCardHoverEnd}
          />
        )}
      </Suspense>

    </div>
  );
}
