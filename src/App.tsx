/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, Suspense, lazy } from 'react';
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
import { SearchScope } from './components/AttachmentMenu';

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

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem('aether_rag_active_session_id_v1');
      if (savedId && INITIAL_SESSIONS.some(s => s.id === savedId)) return savedId;
    } catch (e) {}
    return INITIAL_SESSIONS[0]?.id || 'session-1';
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
  const [lockedIntrospect, setLockedIntrospect] = useState<boolean>(false);
  const [hoverIntrospect, setHoverIntrospect] = useState<boolean>(false);

  // Background WebGL Tunables
  const [particleSpeed, setParticleSpeed] = useState<number>(1.0);
  const [pointSize, setPointSize] = useState<number>(10.0);
  const [vignetteDarkness, setVignetteDarkness] = useState<number>(1.5);
  const [aperture] = useState<number>(1.79);
  const [focus] = useState<number>(3.8);

  // RAG Engine Tunables & Dynamic Models Auto-detection
  const [availableModels, setAvailableModels] = useState<ModelDefinition[]>(AVAILABLE_MODELS);
  const [selectedModel, setSelectedModel] = useState<ModelDefinition>(() => AVAILABLE_MODELS[0]);
  const [thinkingEnabled, setThinkingEnabled] = useState<boolean>(true);
  const [effortLevel, setEffortLevel] = useState<EffortLevel>('medium');
  const [searchScope, setSearchScope] = useState<SearchScope>('local');
  const [ragModel, setRagModel] = useState<string>('gemini-3.8-flash');
  const [topK, setTopK] = useState<number>(5);
  const [temperature, setTemperature] = useState<number>(0.1);
  const [rerankEnabled, setRerankEnabled] = useState<boolean>(true);

  // Auto-detect models on app load
  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.models) && data.models.length > 0) {
          setAvailableModels(data.models);
        }
      })
      .catch(() => {});
  }, []);

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
      const response = await fetch('/api/library/books');
      if (!response.ok) return;
      const data = await response.json();
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
          topK
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

  const handleResetDefaults = () => {
    setParticleSpeed(1.0);
    setPointSize(10.0);
    setVignetteDarkness(1.5);
    setTopK(5);
    setTemperature(0.1);
    setRerankEnabled(true);
  };

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
            onClick={() => setLockedIntrospect(prev => !prev)}
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
              setSelectedModel={setSelectedModel}
              thinkingEnabled={thinkingEnabled}
              setThinkingEnabled={setThinkingEnabled}
              effortLevel={effortLevel}
              setEffortLevel={setEffortLevel}
              searchScope={searchScope}
              setSearchScope={setSearchScope}
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
            ragModel={ragModel}
            setRagModel={setRagModel}
            topK={topK}
            setTopK={setTopK}
            temperature={temperature}
            setTemperature={setTemperature}
            rerankEnabled={rerankEnabled}
            setRerankEnabled={setRerankEnabled}
            particleSpeed={particleSpeed}
            setParticleSpeed={setParticleSpeed}
            pointSize={pointSize}
            setPointSize={setPointSize}
            vignetteDarkness={vignetteDarkness}
            setVignetteDarkness={setVignetteDarkness}
            onResetDefaults={handleResetDefaults}
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
            onCardHoverStart={handleCardHoverStart}
            onCardHoverEnd={handleCardHoverEnd}
          />
        )}
      </Suspense>

    </div>
  );
}
