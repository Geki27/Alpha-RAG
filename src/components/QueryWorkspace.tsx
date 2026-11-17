import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  FileText, 
  Layers, 
  Check, 
  Copy, 
  ExternalLink, 
  Terminal,
  Zap,
  Bold,
  Italic,
  Heading,
  Code,
  Quote,
  List,
  ListOrdered,
  CheckSquare,
  Table,
  Eye,
  Edit3,
  Trash2,
  Maximize2,
  Minimize2,
  FileCode,
  Type,
  Plus,
  Paperclip,
  X,
  Globe,
  HardDrive,
  AtSign,
  Folder,
  Image as ImageIcon,
  Link as LinkIcon,
  ChevronDown
} from 'lucide-react';
import { RagMessage, GroundedCitation, DocumentSource } from '../types/rag';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AttachmentMenu, AttachedResource, SearchScope } from './AttachmentMenu';
import { ModelSelectorMenu } from './ModelSelectorMenu';
import { ModelDefinition, EffortLevel, EFFORT_SHORT_LABELS } from '../types/models';

interface QueryWorkspaceProps {
  messages: RagMessage[];
  onSendMessage: (query: string, scope: SearchScope) => void;
  isGenerating: boolean;
  onSelectCitation: (citation: GroundedCitation) => void;
  onOpenPdfPreview: (documentName: string, pageNumber: number) => void;
  onCardHoverStart: () => void;
  onCardHoverEnd: () => void;
  isSidebarOpen?: boolean;
  documents?: DocumentSource[];
  selectedModel: ModelDefinition;
  setSelectedModel: (m: ModelDefinition) => void;
  thinkingEnabled: boolean;
  setThinkingEnabled: (t: boolean) => void;
  effortLevel: EffortLevel;
  setEffortLevel: (e: EffortLevel) => void;
  searchScope: SearchScope;
  setSearchScope: (s: SearchScope) => void;
  availableModels?: ModelDefinition[];
  setAvailableModels?: (m: ModelDefinition[]) => void;
}

export const QueryWorkspace: React.FC<QueryWorkspaceProps> = ({
  messages,
  onSendMessage,
  isGenerating,
  onSelectCitation,
  onOpenPdfPreview,
  onCardHoverStart,
  onCardHoverEnd,
  isSidebarOpen = false,
  documents = [],
  selectedModel,
  setSelectedModel,
  thinkingEnabled,
  setThinkingEnabled,
  effortLevel,
  setEffortLevel,
  searchScope,
  setSearchScope,
  availableModels,
  setAvailableModels,
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [inputMode, setInputMode] = useState<'normal' | 'markdown'>('normal');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [customMarkdownHeight, setCustomMarkdownHeight] = useState<number | null>(null);
  const [isResizingMarkdown, setIsResizingMarkdown] = useState(false);
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');

  // Attachment Menu & Resources State
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [attachedResources, setAttachedResources] = useState<AttachedResource[]>([]);

  // @ Mention Autocomplete State
  const [showAtMenu, setShowAtMenu] = useState(false);
  const [atFilter, setAtFilter] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const normalTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const inputDockRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Adjust normal input height automatically (slightly larger, bounded at 116px with hidden-scrollbar scroll)
  useEffect(() => {
    const el = normalTextareaRef.current;
    if (el && inputMode === 'normal') {
      el.style.height = 'auto';
      const maxH = 116;
      const nextH = Math.max(36, Math.min(el.scrollHeight, maxH));
      el.style.height = `${nextH}px`;
    }
  }, [inputQuery, inputMode]);

  // Adjust markdown textarea height automatically unless user manually dragged to a custom height
  useEffect(() => {
    const el = textareaRef.current;
    if (el && inputMode === 'markdown') {
      if (customMarkdownHeight !== null) {
        el.style.height = `${customMarkdownHeight}px`;
      } else if (isEditorExpanded) {
        el.style.height = '220px';
      } else {
        el.style.height = 'auto';
        el.style.height = `${Math.max(44, Math.min(el.scrollHeight, 140))}px`;
      }
    }
  }, [inputQuery, isEditorExpanded, customMarkdownHeight, inputMode, activeTab]);

  // Close attachment menu and model menu on click outside or Escape
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (inputDockRef.current && !inputDockRef.current.contains(e.target as Node)) {
        setIsAttachmentMenuOpen(false);
        setIsModelMenuOpen(false);
        setShowAtMenu(false);
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAttachmentMenuOpen(false);
        setIsModelMenuOpen(false);
        setShowAtMenu(false);
      }
    };

    window.addEventListener('mousedown', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const currentEffortBadge = EFFORT_SHORT_LABELS[effortLevel] || 'Med';

  // Handle @ mention detection while typing
  const handleInputChange = (value: string) => {
    setInputQuery(value);

    // Check if user is typing an @ mention
    const atMatch = value.match(/@([a-zA-Z0-9_-]*)$/);
    if (atMatch) {
      setShowAtMenu(true);
      setAtFilter(atMatch[1].toLowerCase());
    } else {
      setShowAtMenu(false);
    }
  };

  const handleSelectAtDocument = (docTitle: string) => {
    const cleanTag = '@' + docTitle.replace(/\s+/g, '_') + ' ';
    const replaced = inputQuery.replace(/@([a-zA-Z0-9_-]*)$/, cleanTag);
    setInputQuery(replaced);
    setShowAtMenu(false);
    if (inputMode === 'normal' && normalTextareaRef.current) {
      normalTextareaRef.current.focus();
    } else if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleAddAttachedResource = (res: AttachedResource) => {
    setAttachedResources(prev => [...prev, res]);
  };

  const handleRemoveAttachedResource = (id: string) => {
    setAttachedResources(prev => prev.filter(r => r.id !== id));
  };

  const handleSelectSnippet = (snippet: string) => {
    setInputQuery(prev => prev ? `${prev}\n\n${snippet}` : snippet);
    if (inputMode === 'normal' && normalTextareaRef.current) {
      normalTextareaRef.current.focus();
    } else if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Drag handle to resize Markdown block freely at will
  const handleMarkdownResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const currentElHeight =
      customMarkdownHeight ??
      textareaRef.current?.offsetHeight ??
      (isEditorExpanded ? 220 : 72);

    setIsResizingMarkdown(true);
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    const maxHeight = Math.max(260, Math.round(window.innerHeight * 0.62));

    const handlePointerMove = (moveEv: PointerEvent) => {
      const deltaY = startY - moveEv.clientY;
      const nextHeight = Math.max(64, Math.min(maxHeight, Math.round(currentElHeight + deltaY)));
      setCustomMarkdownHeight(nextHeight);
    };

    const handlePointerUp = () => {
      setIsResizingMarkdown(false);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputQuery.trim() && attachedResources.length === 0) || isGenerating) return;

    // Compose final query string with attachments and scope context
    let finalQuery = inputQuery.trim();

    if (attachedResources.length > 0) {
      const attachmentsList = attachedResources.map(r => {
        if (r.type === 'file') return `[Adjunto Archivo: ${r.name} (${r.size})]`;
        if (r.type === 'folder') return `[Adjunta Carpeta: ${r.name} (${r.fileCount} archivos)]`;
        if (r.type === 'image') return `[Adjunta Imagen: ${r.name}]`;
        if (r.type === 'url') return `[Adjunto Enlace: ${r.name} -> ${r.previewUrl}]`;
        return `[Adjunto: ${r.name}]`;
      }).join(' ');

      finalQuery = finalQuery 
        ? `${finalQuery}\n\n${attachmentsList}`
        : `Análisis solicitado para los recursos adjuntos: ${attachmentsList}`;
    }

    // Automatically detect or sync scope
    let effectiveScope = searchScope;
    if (/\[Alcance:\s*(?:Búsqueda\s*)?Web\]/i.test(finalQuery) || /\[Web\]/i.test(finalQuery)) {
      effectiveScope = 'web';
    } else if (/\[Alcance:\s*(?:Búsqueda\s*)?(?:Híbrida|Ambas)\]/i.test(finalQuery) || /\[Ambas\]/i.test(finalQuery)) {
      effectiveScope = 'ambas';
    } else if (/\[Alcance:\s*(?:Búsqueda\s*)?Local\]/i.test(finalQuery) || /\[Local\]/i.test(finalQuery)) {
      effectiveScope = 'local';
    } else if (searchScope !== 'local') {
      const scopeLabel = searchScope === 'web' ? 'Búsqueda Web' : 'Búsqueda Híbrida (Local + Web)';
      finalQuery = `[Alcance: ${scopeLabel}]\n${finalQuery}`;
    }

    onSendMessage(finalQuery, effectiveScope);
    setInputQuery('');
    setAttachedResources([]);
    setIsAttachmentMenuOpen(false);
    setIsModelMenuOpen(false);
    setShowAtMenu(false);
    setActiveTab('write');
    if (isEditorExpanded) {
      setIsEditorExpanded(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleSubmit();
      } else if (!isEditorExpanded && customMarkdownHeight === null && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  const handleNormalKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to insert markdown tags at selection or cursor
  const insertMarkdown = (prefix: string, suffix = '', defaultText = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = inputQuery.substring(start, end);
    const replacement = selection || defaultText;

    const newText = 
      inputQuery.substring(0, start) + 
      prefix + 
      replacement + 
      suffix + 
      inputQuery.substring(end);

    setInputQuery(newText);
    setActiveTab('write');

    setTimeout(() => {
      textarea.focus();
      const cursorStart = start + prefix.length;
      const cursorEnd = cursorStart + replacement.length;
      textarea.setSelectionRange(cursorStart, cursorEnd);
    }, 20);
  };

  const insertTableTemplate = () => {
    const template = `\n| Parámetro / Métrica | Valor Esperado | Cláusula SLA |\n| :--- | :--- | :--- |\n| Disponibilidad Mensual | 99.95% | Cláusula 5.2 |\n| Latencia Máxima | < 450 ms | Cláusula 3.4 |\n`;
    insertMarkdown(template);
  };

  const insertCodeBlock = () => {
    const template = `\n\`\`\`yaml\nservice: transactional-core\ncircuitBreaker:\n  timeoutMs: 450\n  threshold: 0.12\n\`\`\`\n`;
    insertMarkdown(template);
  };

  // Autocomplete suggestions based on available documents
  const filteredAtDocuments = documents.filter(d => {
    const title = d.title || d.name || '';
    return title.toLowerCase().includes(atFilter);
  });

  return (
    <div className="relative flex flex-col max-w-5xl mx-auto w-full px-4 sm:px-6 h-screen">
      {/* Capa 2: Message Scroll Viewport Layer (z-10) */}
      <div 
        ref={scrollContainerRef}
        className={`flex-1 min-h-0 overflow-y-auto pr-2 z-10 transition-all duration-300 flex flex-col ${
          messages.length === 0
            ? 'pb-24 pt-0'
            : (isEditorExpanded ? 'space-y-6 pt-6 pb-80' : 'space-y-6 pt-6 pb-60')
        }`}
      >
        {messages.length === 0 ? (
          /* Empty / New Conversation Centered Hero State */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 select-none animate-fade-in translate-y-4 sm:translate-y-6">
            <h1 
              className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white leading-none select-none"
              style={{ fontFamily: '"Times New Roman", Times, Georgia, "Cambria Math", serif' }}
            >
              Alpha RAG
            </h1>
            <p 
              className="text-sm sm:text-lg md:text-xl font-normal text-neutral-300 tracking-wider mt-2.5 sm:mt-3 select-none"
              style={{ fontFamily: '"Times New Roman", Times, Georgia, "Cambria Math", serif' }}
            >
              For Mechanicals Engineers
            </p>
          </div>
        ) : (
          /* Conversation Message Feed */
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col ${
                message.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                onMouseEnter={onCardHoverStart}
                onMouseLeave={onCardHoverEnd}
                className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 transition-all duration-300 ${
                  message.role === 'user'
                    ? 'glass-msg-user text-white rounded-br-xs'
                    : 'glass-msg-assistant text-neutral-100 rounded-bl-xs'
                }`}
              >
                {/* Header Row: Role & Timestamp */}
                <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-white/[0.08] text-xs font-mono">
                  <span className="flex items-center gap-1.5 font-semibold tracking-wider uppercase text-[11px] text-neutral-300">
                    {message.role === 'user' ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-white/70" />
                        <span>CONSULTA INGENIERÍA</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-white/80" />
                        <span>SÍNTESIS ALPHA RAG</span>
                      </>
                    )}
                  </span>
                  
                  <div className="flex items-center gap-2 text-neutral-400 text-[10px]">
                    <span>{message.timestamp}</span>
                    <button
                      onClick={() => handleCopy(message.id, message.content)}
                      className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      title="Copiar contenido"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3 h-3 text-white" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Message Body with KaTeX Markdown Renderer */}
                <MarkdownRenderer content={message.content} role={message.role} />

                {/* Grounded Citations Section */}
                {message.citations && message.citations.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/[0.08] space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-300">
                        <Layers className="w-3 h-3 text-white/70" />
                        <span>FUENTES RECUPERADAS ({message.citations.length})</span>
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px]">
                        {message.metrics?.provider && (
                          <span className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-neutral-300 font-sans">
                            {message.metrics.provider === 'nvidia' ? 'NVIDIA NIM' : 'Google AI'}
                          </span>
                        )}
                        {message.metrics?.searchScope && (
                          <span className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-neutral-300 font-sans">
                            {message.metrics.searchScope === 'ambas' ? 'Híbrida' : message.metrics.searchScope === 'web' ? 'Web' : 'Local'}
                          </span>
                        )}
                        <span className="text-neutral-500">{message.metrics?.retrievalMs ? `${message.metrics.retrievalMs}ms` : 'Verificadas'}</span>
                      </div>
                    </div>

                    {/* Web Search Queries Badge */}
                    {message.metrics?.webQueries && message.metrics.webQueries.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5 pb-1 text-[10px] font-mono text-cyan-300/80">
                        <span className="text-neutral-400">Consultas web ejecutadas:</span>
                        {message.metrics.webQueries.slice(0, 3).map((wq, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/20 text-cyan-200 truncate max-w-[260px]">
                            "{wq}"
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {message.citations.map((citation) => {
                        const isWeb = citation.type === 'web';
                        return (
                          <button
                            key={citation.id}
                            onClick={() => {
                              onSelectCitation(citation);
                            }}
                            className={`flex flex-col text-left p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border transition-all duration-200 group cursor-pointer ${
                              isWeb 
                                ? 'border-cyan-500/20 hover:border-cyan-400/40' 
                                : 'border-white/[0.08] hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full text-xs font-mono">
                              <span className="font-semibold text-white truncate max-w-[170px] group-hover:text-neutral-200 font-sans flex items-center gap-1.5">
                                {isWeb ? (
                                  <Globe className="w-3 h-3 text-cyan-300 shrink-0" />
                                ) : (
                                  <FileText className="w-3 h-3 text-amber-300/80 shrink-0" />
                                )}
                                <span className="truncate">{citation.documentName}</span>
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                isWeb 
                                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20' 
                                  : 'bg-white/[0.08] text-neutral-300'
                              }`}>
                                {isWeb ? (citation.domain || 'Web') : `Pág. ${citation.pageNumber}`}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-400 line-clamp-2 mt-1 leading-snug font-sans">
                              {citation.excerpt}
                            </p>
                            <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 mt-2">
                              <span>Afinidad: {(citation.similarityScore * 100).toFixed(1)}%</span>
                              {isWeb ? (
                                <span 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (citation.url) {
                                      window.open(citation.url, '_blank', 'noopener,noreferrer');
                                    }
                                  }}
                                  className="text-cyan-300 hover:text-cyan-100 flex items-center gap-0.5 underline decoration-cyan-400/30 hover:decoration-cyan-400 transition-colors"
                                >
                                  <span>Abrir norma</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </span>
                              ) : (
                                <span 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenPdfPreview(citation.documentName, citation.pageNumber);
                                  }}
                                  className="text-neutral-300 hover:text-white flex items-center gap-0.5 underline decoration-white/30 hover:decoration-white"
                                >
                                  <span>Abrir pág.</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Loading Spinner during Generation */}
        {isGenerating && (
          <div className="flex items-start">
            <div className="glass-msg-assistant rounded-2xl rounded-bl-xs p-4 sm:p-5 text-neutral-200 max-w-[80%] flex items-center gap-3">
              <Zap className="w-4 h-4 animate-spin text-white" />
              <div className="space-y-1">
                <p className="text-xs font-mono text-white tracking-wide">
                  RECUPERANDO CHUNKS & SINTETIZANDO RESPUESTA...
                </p>
                <p className="text-[11px] font-mono text-neutral-400">
                  Calculando similitud coseno y resolviendo ecuaciones LaTeX
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom anchor for auto-scroll */}
        <div ref={messagesEndRef} className="h-4 shrink-0" />
      </div>

      {/* Capa 3: Fading Gradient Scrim Layer */}
      <div 
        className={`pointer-events-none fixed bottom-0 right-0 z-20 bg-gradient-to-t from-[#030303] from-40% via-[#030303]/90 via-70% to-transparent transition-all duration-300 ease-out ${
          isSidebarOpen ? 'left-0 md:left-[340px]' : 'left-0'
        } ${inputMode === 'normal' ? 'h-40' : (isEditorExpanded ? 'h-80' : 'h-60')}`}
      />

      {/* Capa 4: Docked Glassmorphic Query Input Dock (z-30) */}
      <div 
        ref={inputDockRef}
        className={`fixed bottom-4 sm:bottom-6 right-0 z-30 max-w-5xl mx-auto px-4 sm:px-6 transition-all duration-300 ease-out ${
          isSidebarOpen ? 'left-0 md:left-[340px]' : 'left-0'
        }`}
      >
        <div className="relative flex items-end gap-2.5 w-full">
          
          {/* POPUP 1: OUTGOING ATTACHMENT MENU (z-50) */}
          <AttachmentMenu
            isOpen={isAttachmentMenuOpen}
            onClose={() => setIsAttachmentMenuOpen(false)}
            onAttachResource={handleAddAttachedResource}
            onSelectPromptSnippet={handleSelectSnippet}
            searchScope={searchScope}
            setSearchScope={setSearchScope}
          />

          {/* POPUP 2: MODEL & EFFORT SELECTOR MENU (z-50) - Exact same z-index, Y-index elevation & glassmorphism as AttachmentMenu */}
          <ModelSelectorMenu
            isOpen={isModelMenuOpen}
            onClose={() => setIsModelMenuOpen(false)}
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            thinkingEnabled={thinkingEnabled}
            onToggleThinking={setThinkingEnabled}
            effortLevel={effortLevel}
            onSelectEffort={setEffortLevel}
            models={availableModels}
            onModelsDetected={setAvailableModels}
          />

          {/* POPUP 3: @ REFERENCE AUTOCOMPLETE DROPDOWN (z-50) */}
          {showAtMenu && (
            <div 
              className="absolute bottom-full mb-3 left-12 w-72 sm:w-80 rounded-2xl border border-white/15 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95"
              style={{
                backgroundColor: 'rgba(16, 16, 16, 0.88)',
                backdropFilter: 'blur(24px) saturate(160%)',
                WebkitBackdropFilter: 'blur(24px) saturate(160%)',
              }}
            >
              <div className="text-[10px] font-mono text-neutral-400 uppercase px-2 py-1 flex items-center justify-between">
                <span>Referenciar Libro de Texto:</span>
                <span className="text-[9px] text-neutral-500">Filtrar: @{atFilter}</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 mt-1">
                {filteredAtDocuments.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-neutral-500 font-sans italic">
                    No se encontraron libros que coincidan
                  </div>
                ) : (
                  filteredAtDocuments.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => handleSelectAtDocument(doc.title || doc.name)}
                      className="w-full text-left p-2 rounded-xl hover:bg-white/[0.08] transition-colors flex items-center gap-2 cursor-pointer group"
                    >
                      <div className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                        <FileText className="w-3.5 h-3.5 text-neutral-300 group-hover:text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate font-sans">
                          {doc.title || doc.name}
                        </div>
                        <div className="text-[10px] font-mono text-neutral-400 truncate">
                          {doc.discipline || doc.category} · {doc.pages} págs
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Main Query Container */}
          <div className="flex-1 min-w-0">
            {inputMode === 'normal' ? (
              /* MODO ENTRADA DE TEXTO NORMAL (Matching screenshot layout) */
              <div
                onMouseEnter={onCardHoverStart}
                onMouseLeave={onCardHoverEnd}
                className="relative rounded-2xl glass-panel shadow-2xl border border-white/15 focus-within:border-white/40 focus-within:ring-2 focus-within:ring-white/10 transition-all duration-300 bg-[#0c0c0c]/90 backdrop-blur-2xl p-2 sm:p-2.5"
              >
                {/* Attached resources badges above the input text */}
                {attachedResources.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap px-2 pt-1 pb-2 border-b border-white/[0.06]">
                    {attachedResources.map((res) => (
                      <div 
                        key={res.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.06] border border-white/12 text-xs font-sans text-neutral-200 animate-fade-in"
                      >
                        {res.type === 'file' && <FileText className="w-3 h-3 text-neutral-300" />}
                        {res.type === 'folder' && <Folder className="w-3 h-3 text-amber-300" />}
                        {res.type === 'image' && <ImageIcon className="w-3 h-3 text-emerald-300" />}
                        {res.type === 'url' && <LinkIcon className="w-3 h-3 text-cyan-300" />}
                        <span className="truncate max-w-[140px] font-medium">{res.name}</span>
                        {res.size && <span className="text-[10px] font-mono text-neutral-400">({res.size})</span>}
                        {res.fileCount && <span className="text-[10px] font-mono text-neutral-400">({res.fileCount} arch.)</span>}
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachedResource(res.id)}
                          className="hover:text-white text-neutral-400 transition-colors ml-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="flex items-end gap-2">
                  {/* Round Attachment '+' button matching the screenshot */}
                  <button
                    type="button"
                    onClick={() => setIsAttachmentMenuOpen(prev => !prev)}
                    className={`w-8 h-8 mb-0.5 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0 border ${
                      isAttachmentMenuOpen
                        ? 'bg-white text-black border-white shadow-md scale-105'
                        : 'bg-white/[0.06] hover:bg-white/[0.12] text-white border-white/12 hover:border-white/30'
                    }`}
                    title={isAttachmentMenuOpen ? 'Cerrar menú de adjuntos' : 'Adjuntar archivos, carpetas, imágenes o URLs'}
                  >
                    <Plus className={`w-4 h-4 transition-transform duration-200 ${isAttachmentMenuOpen ? 'rotate-45' : ''}`} />
                  </button>

                  {/* Auto-growing bounded textarea with hidden scrollbar */}
                  <textarea
                    ref={normalTextareaRef}
                    rows={1}
                    value={inputQuery}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleNormalKeyDown}
                    placeholder="Pregúntale al RAG o escribe tu consulta..."
                    className="flex-1 bg-transparent px-2 py-1.5 text-sm leading-relaxed text-white placeholder-neutral-500 focus:outline-none font-sans resize-none overflow-y-auto max-h-[116px] min-h-[36px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    disabled={isGenerating}
                  />

                  <div className="flex items-center gap-2 shrink-0 mb-0.5">
                    {/* Model & Effort Selector Pill Trigger */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsModelMenuOpen(prev => !prev);
                          setIsAttachmentMenuOpen(false);
                        }}
                        className={`px-3 py-1.5 rounded-full border text-xs font-sans flex items-center gap-1.5 cursor-pointer transition-all duration-150 select-none ${
                          isModelMenuOpen
                            ? 'bg-white text-black border-white shadow-md font-semibold'
                            : 'bg-white/[0.06] hover:bg-white/[0.12] text-neutral-200 border-white/15'
                        }`}
                        title="Seleccionar modelo y esfuerzo"
                      >
                        <span className="truncate max-w-[110px] sm:max-w-[130px] font-medium">
                          {selectedModel.shortName} · {currentEffortBadge}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isModelMenuOpen ? 'rotate-180 text-black' : 'text-neutral-400'}`} />
                      </button>
                    </div>

                    {/* Botón de Enviar (solo flecha brillante) */}
                    <button
                      type="submit"
                      disabled={(!inputQuery.trim() && attachedResources.length === 0) || isGenerating}
                      aria-label="Consultar"
                      title="Consultar"
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                        (inputQuery.trim() || attachedResources.length > 0) && !isGenerating
                          ? 'bg-white text-black hover:bg-neutral-100 shadow-[0_0_18px_rgba(255,255,255,0.55)] hover:shadow-[0_0_24px_rgba(255,255,255,0.75)] cursor-pointer active:scale-95'
                          : 'bg-white/[0.06] text-neutral-500 cursor-not-allowed border border-white/[0.06]'
                      }`}
                    >
                      <Send className={`w-3.5 h-3.5 ${(inputQuery.trim() || attachedResources.length > 0) && !isGenerating ? 'drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]' : ''}`} />
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* MODO ENTRADA CON .MD (MARKDOWN COMPOSER) */
              <div
                onMouseEnter={onCardHoverStart}
                onMouseLeave={onCardHoverEnd}
                className={`relative rounded-2xl glass-panel shadow-2xl border border-white/15 focus-within:border-white/40 focus-within:ring-2 focus-within:ring-white/10 bg-[#0c0c0c]/90 backdrop-blur-2xl overflow-hidden ${
                  isResizingMarkdown ? 'transition-none border-white/40' : 'transition-all duration-300'
                }`}
              >
                {/* Top Drag Handle to resize Markdown block freely at will */}
                <div
                  onPointerDown={handleMarkdownResizeStart}
                  onDoubleClick={() => {
                    setCustomMarkdownHeight(null);
                    setIsEditorExpanded(false);
                  }}
                  className="w-full h-3 flex items-center justify-center cursor-ns-resize bg-white/[0.02] hover:bg-white/[0.08] border-b border-white/[0.05] transition-colors group select-none touch-none"
                  title="Arrastra hacia arriba o abajo para agrandar el editor a voluntad (doble clic para restablecer)"
                >
                  <div className="w-10 h-1 rounded-full bg-white/25 group-hover:bg-white/70 transition-colors" />
                </div>

                {/* Attached resources badges */}
                {attachedResources.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap px-3 pt-2 pb-1 bg-white/[0.02] border-b border-white/[0.06]">
                    {attachedResources.map((res) => (
                      <div 
                        key={res.id}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/10 text-xs font-sans text-neutral-200"
                      >
                        {res.type === 'file' && <FileText className="w-3 h-3 text-neutral-300" />}
                        {res.type === 'folder' && <Folder className="w-3 h-3 text-amber-300" />}
                        {res.type === 'image' && <ImageIcon className="w-3 h-3 text-emerald-300" />}
                        {res.type === 'url' && <LinkIcon className="w-3 h-3 text-cyan-300" />}
                        <span className="truncate max-w-[140px]">{res.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachedResource(res.id)}
                          className="hover:text-white text-neutral-400 transition-colors ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Top Markdown Formatting Bar */}
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.08] bg-white/[0.02] text-xs font-mono">
                  {/* Left toolbar buttons with '+' button included */}
                  <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                    {/* Attachment button in markdown toolbar */}
                    <button
                      type="button"
                      onClick={() => setIsAttachmentMenuOpen(prev => !prev)}
                      className={`p-1.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer mr-1 ${
                        isAttachmentMenuOpen ? 'bg-white text-black font-semibold' : 'hover:bg-white/[0.1] text-neutral-300 hover:text-white'
                      }`}
                      title="Adjuntar recursos"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1 pr-2 border-r border-white/10">
                      <button
                        type="button"
                        onClick={() => insertMarkdown('**', '**', 'texto en negrita')}
                        className="p-1.5 rounded hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title="Negrita (**texto**)"
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdown('*', '*', 'texto en cursiva')}
                        className="p-1.5 rounded hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title="Cursiva (*texto*)"
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdown('### ', '', 'Título de sección')}
                        className="p-1.5 rounded hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title="Encabezado H3 (### Título)"
                      >
                        <Heading className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1 px-1.5 border-r border-white/10">
                      <button
                        type="button"
                        onClick={() => insertMarkdown('`', '`', 'código')}
                        className="p-1.5 rounded hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title="Código en línea (`código`)"
                      >
                        <Code className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={insertCodeBlock}
                        className="p-1.5 rounded hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title="Bloque de código (```yaml)"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={insertTableTemplate}
                        className="p-1.5 rounded hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title="Tabla Markdown (| Col 1 | Col 2 |)"
                      >
                        <Table className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1 pl-1">
                      <button
                        type="button"
                        onClick={() => insertMarkdown('- ', '', 'Elemento de lista')}
                        className="p-1.5 rounded hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title="Lista con viñetas (- elemento)"
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdown('1. ', '', 'Primer paso')}
                        className="p-1.5 rounded hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title="Lista numerada (1. item)"
                      >
                        <ListOrdered className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdown('> ', '', 'Cita o aclaración')}
                        className="p-1.5 rounded hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title="Cita / Callout (> cita)"
                      >
                        <Quote className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdown('- [ ] ', '', 'Tarea')}
                        className="p-1.5 rounded hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title="Checklist (- [ ] tarea)"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Right action controls */}
                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    <div className="flex items-center bg-black/60 rounded-lg p-0.5 border border-white/10 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setActiveTab('write')}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors cursor-pointer ${
                          activeTab === 'write'
                            ? 'bg-white text-black font-semibold'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>Redactar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('preview')}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors cursor-pointer ${
                          activeTab === 'preview'
                            ? 'bg-white text-black font-semibold'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                        title="Vista previa renderizada en vivo"
                      >
                        <Eye className="w-2.5 h-2.5" />
                        <span>Vista Previa</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (customMarkdownHeight !== null || isEditorExpanded) {
                          setCustomMarkdownHeight(null);
                          setIsEditorExpanded(false);
                        } else {
                          setIsEditorExpanded(true);
                        }
                      }}
                      className="p-1 rounded-md hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      title={isEditorExpanded || customMarkdownHeight !== null ? 'Reducir editor' : 'Expandir editor .md'}
                    >
                      {isEditorExpanded || customMarkdownHeight !== null ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Editor Body or Preview Body */}
                <form onSubmit={handleSubmit} className="p-2 sm:p-2.5 flex flex-col gap-2">
                  {activeTab === 'write' ? (
                    <div className="relative">
                      <textarea
                        ref={textareaRef}
                        value={inputQuery}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Redacta tu consulta en formato Markdown (.md)... Puedes agrandar este bloque arrastrando su borde superior."
                        rows={isEditorExpanded ? 5 : 2}
                        style={customMarkdownHeight !== null ? { height: `${customMarkdownHeight}px` } : undefined}
                        className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none font-mono resize-none overflow-y-auto leading-relaxed selection:bg-white selection:text-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        disabled={isGenerating}
                      />
                    </div>
                  ) : (
                    <div
                      style={customMarkdownHeight !== null ? { height: `${customMarkdownHeight}px` } : undefined}
                      className="px-3 py-2.5 min-h-[70px] max-h-[60vh] overflow-y-auto rounded-xl bg-black/40 border border-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      {inputQuery.trim() ? (
                        <MarkdownRenderer content={inputQuery} role="user" />
                      ) : (
                        <div className="text-xs text-neutral-500 italic font-mono py-3 text-center">
                          Escribe contenido en Markdown en la pestaña &ldquo;Redactar&rdquo; para visualizarlo aquí con formato agradable.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bottom Actions Row */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-[11px] font-mono">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <span className="hidden sm:inline">
                        <span className="text-neutral-300 font-semibold">Ctrl + Enter</span> para enviar
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span className="text-neutral-500">
                        {inputQuery.length} caracteres
                      </span>
                      {inputQuery.trim() && (
                        <button
                          type="button"
                          onClick={() => setInputQuery('')}
                          className="flex items-center gap-1 text-neutral-500 hover:text-white transition-colors ml-1 cursor-pointer"
                          title="Limpiar texto"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Limpiar</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Model & Effort Selector Pill Trigger in .md mode */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setIsModelMenuOpen(prev => !prev);
                            setIsAttachmentMenuOpen(false);
                          }}
                          className={`px-3 py-1.5 rounded-full border text-xs font-sans flex items-center gap-1.5 cursor-pointer transition-all duration-150 select-none ${
                            isModelMenuOpen
                              ? 'bg-white text-black border-white shadow-md font-semibold'
                              : 'bg-white/[0.06] hover:bg-white/[0.12] text-neutral-200 border-white/15'
                          }`}
                          title="Seleccionar modelo y esfuerzo"
                        >
                          <span className="truncate max-w-[110px] font-medium">
                            {selectedModel.shortName} · {currentEffortBadge}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isModelMenuOpen ? 'rotate-180 text-black' : 'text-neutral-400'}`} />
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={(!inputQuery.trim() && attachedResources.length === 0) || isGenerating}
                        aria-label="Consultar .md"
                        title="Consultar .md"
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                          (inputQuery.trim() || attachedResources.length > 0) && !isGenerating
                            ? 'bg-white text-black hover:bg-neutral-100 shadow-[0_0_18px_rgba(255,255,255,0.55)] hover:shadow-[0_0_24px_rgba(255,255,255,0.75)] cursor-pointer active:scale-95'
                            : 'bg-white/[0.06] text-neutral-500 cursor-not-allowed border border-white/[0.06]'
                        }`}
                      >
                        <Send className={`w-3.5 h-3.5 ${(inputQuery.trim() || attachedResources.length > 0) && !isGenerating ? 'drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]' : ''}`} />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Componente selector FUERA del área de entrada al lado derecho */}
          <div
            onMouseEnter={onCardHoverStart}
            onMouseLeave={onCardHoverEnd}
            className="shrink-0 glass-panel rounded-2xl p-1 border border-white/15 bg-[#0c0c0c]/90 backdrop-blur-2xl shadow-2xl flex items-center gap-1"
          >
            <button
              type="button"
              onClick={() => setInputMode('normal')}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-mono font-medium transition-all duration-200 cursor-pointer ${
                inputMode === 'normal'
                  ? 'bg-white text-black shadow-md font-semibold'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.08]'
              }`}
              title="Modo entrada de texto normal"
            >
              <Type className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Texto</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('markdown')}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-mono font-medium transition-all duration-200 cursor-pointer ${
                inputMode === 'markdown'
                  ? 'bg-white text-black shadow-md font-semibold'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.08]'
              }`}
              title="Modo entrada con formato .md (Markdown)"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span className="font-bold text-[11px]">.md</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
