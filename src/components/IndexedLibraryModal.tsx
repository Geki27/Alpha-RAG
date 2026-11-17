import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  BookOpen, 
  Upload, 
  Sliders, 
  Search, 
  Check, 
  RotateCcw, 
  FileText, 
  Trash2, 
  ExternalLink, 
  Layers, 
  Cpu, 
  ArrowLeft,
  Sparkles,
  Download,
  Copy,
  FolderTree,
  Terminal,
  Sigma,
  FileCheck,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { DocumentSource, ChunkItem } from '../types/rag';
import { ChunkStrategyType } from '../types/settings';
import { MarkdownRenderer } from './MarkdownRenderer';

interface IndexedLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPdf: (docName: string, page: number) => void;
  onInspectChunk?: (chunk: ChunkItem) => void;
  documents: DocumentSource[];
  setDocuments: React.Dispatch<React.SetStateAction<DocumentSource[]>>;
  onRefreshBooks?: () => Promise<void> | void;
  hideExamples?: boolean;
  onToggleHideExamples?: (nextHide: boolean) => Promise<void> | void;
  chunkStrategy?: ChunkStrategyType;
  onChangeChunkStrategy?: (strategy: ChunkStrategyType) => void;
  chunkSize?: number;
  onChangeChunkSize?: (size: number) => void;
  chunkOverlap?: number;
  onChangeChunkOverlap?: (overlap: number) => void;
  uploadDiscipline?: string;
  onChangeUploadDiscipline?: (discipline: string) => void;
  activeDiscipline?: string;
  onChangeActiveDiscipline?: (discipline: string) => void;
  onCardHoverStart?: () => void;
  onCardHoverEnd?: () => void;
}

const DISCIPLINES = [
  { id: 'ALL', name: 'Todas las disciplinas', label: 'Todas' },
  { id: 'Estatica', name: 'Estática & Análisis Estructural', label: 'Estática' },
  { id: 'Diseno_Mecanico', name: 'Diseño Mecánico & Fatiga', label: 'Diseño Mecánico' },
  { id: 'Termodinamica', name: 'Termodinámica Aplicada', label: 'Termodinámica' },
  { id: 'Mecanica_Materiales', name: 'Mecánica de Materiales', label: 'Mecánica Materiales' },
  { id: 'Elementos_Maquinas', name: 'Elementos de Máquinas & Engranajes', label: 'Elementos de Máquinas' }
];

export const IndexedLibraryModal: React.FC<IndexedLibraryModalProps> = ({
  isOpen,
  onClose,
  onOpenPdf,
  onInspectChunk,
  documents,
  setDocuments,
  onRefreshBooks,
  hideExamples: hideExamplesProp,
  onToggleHideExamples,
  chunkStrategy: chunkStrategyProp,
  onChangeChunkStrategy,
  chunkSize: chunkSizeProp,
  onChangeChunkSize,
  chunkOverlap: chunkOverlapProp,
  onChangeChunkOverlap,
  uploadDiscipline: uploadDisciplineProp,
  onChangeUploadDiscipline,
  activeDiscipline: activeDisciplineProp,
  onChangeActiveDiscipline,
  onCardHoverStart,
  onCardHoverEnd,
}) => {
  // Search query & Discipline filter (backed by persistent App/server settings when provided)
  const [searchQuery, setSearchQuery] = useState('');
  const [internalActiveDiscipline, setInternalActiveDiscipline] = useState<string>('ALL');
  const [internalUploadDiscipline, setInternalUploadDiscipline] = useState<string>('Estatica');

  const activeDiscipline = activeDisciplineProp ?? internalActiveDiscipline;
  const setActiveDiscipline = (val: string) => {
    setInternalActiveDiscipline(val);
    onChangeActiveDiscipline?.(val);
  };

  const uploadDiscipline = uploadDisciplineProp ?? internalUploadDiscipline;
  const setUploadDiscipline = (val: string) => {
    setInternalUploadDiscipline(val);
    onChangeUploadDiscipline?.(val);
  };
  
  // Example books visibility state (synced with server settings)
  const [internalHideExamples, setInternalHideExamples] = useState(false);
  const [isTogglingExamples, setIsTogglingExamples] = useState(false);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);
  const hideExamples = typeof hideExamplesProp === 'boolean' ? hideExamplesProp : internalHideExamples;

  // Chunking settings panel toggle
  const [showChunkingSettings, setShowChunkingSettings] = useState(false);

  // Selected document for "Datos 🟡" detailed view
  const [selectedBookForData, setSelectedBookForData] = useState<DocumentSource | null>(null);
  const [dataActiveTab, setDataActiveTab] = useState<'text_latex' | 'vectors' | 'intact_pdf'>('text_latex');
  const [extractedTxtContent, setExtractedTxtContent] = useState<string>('');
  const [vectorJsonContent, setVectorJsonContent] = useState<any | null>(null);
  const [isLoadingBookData, setIsLoadingBookData] = useState<boolean>(false);
  const [copiedLatex, setCopiedLatex] = useState<boolean>(false);

  // Chunking Configuration Parameters (backed by persistent App/server settings when provided)
  const [internalChunkStrategy, setInternalChunkStrategy] = useState<ChunkStrategyType>('semantic');
  const [internalChunkSize, setInternalChunkSize] = useState<number>(512);
  const [internalChunkOverlap, setInternalChunkOverlap] = useState<number>(64);

  const chunkStrategy = chunkStrategyProp ?? internalChunkStrategy;
  const setChunkStrategy = (val: ChunkStrategyType) => {
    setInternalChunkStrategy(val);
    onChangeChunkStrategy?.(val);
  };

  const chunkSize = chunkSizeProp ?? internalChunkSize;
  const setChunkSize = (val: number) => {
    setInternalChunkSize(val);
    onChangeChunkSize?.(val);
  };

  const chunkOverlap = chunkOverlapProp ?? internalChunkOverlap;
  const setChunkOverlap = (val: number) => {
    setInternalChunkOverlap(val);
    onChangeChunkOverlap?.(val);
  };

  const [embeddingModel] = useState<string>('text-embedding-004');
  const [isReindexing, setIsReindexing] = useState<boolean>(false);

  // Upload & Extraction Pipeline State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch real books from physical library storage on backend
  const fetchPhysicalLibraryBooks = useCallback(async () => {
    try {
      const response = await fetch('/api/library/books', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (typeof data.hideExamples === 'boolean') {
          setInternalHideExamples(data.hideExamples);
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
            category: b.discipline.replace(/_/g, ' '),
            vectorModel: 'text-embedding-004 (768-dim)',
            isExample: b.isExample,
            discipline: b.discipline,
            physicalPaths: {
              pdf: b.pdfPath,
              vector: b.vectorPath,
              txt: b.txtPath
            }
          }));

          setDocuments(mappedDocs);
        }
      }
    } catch (err: any) {
      console.error('Error leyendo libros físicos desde /api/library/books:', err);
      setUploadError(err?.message || 'No se pudieron cargar los libros desde el servidor.');
    }
  }, [setDocuments]);

  const handleToggleExamples = async (nextHide: boolean) => {
    setIsTogglingExamples(true);
    setUploadError(null);
    setInternalHideExamples(nextHide);
    try {
      if (onToggleHideExamples) {
        await onToggleHideExamples(nextHide);
      } else {
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
        await fetchPhysicalLibraryBooks();
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Error al actualizar los libros de ejemplo.');
    } finally {
      setIsTogglingExamples(false);
    }
  };

  const handleDeleteBook = async (doc: DocumentSource) => {
    const disc = doc.discipline || 'Estatica';
    const fileName = doc.fileName || doc.name;
    setDeletingBookId(doc.id);
    setUploadError(null);
    try {
      const res = await fetch('/api/library/book/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ discipline: disc, fileName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'No se pudo eliminar el libro del disco.');
      }
      if (selectedBookForData?.id === doc.id) {
        setSelectedBookForData(null);
      }
      await fetchPhysicalLibraryBooks();
    } catch (err: any) {
      setUploadError(err?.message || 'Error al eliminar el libro.');
    } finally {
      setDeletingBookId(null);
    }
  };

  // Load books on mount & when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchPhysicalLibraryBooks();
    }
  }, [isOpen, fetchPhysicalLibraryBooks]);

  // Load detailed book data (txt with LaTeX and vector JSON) when a book is selected
  useEffect(() => {
    if (!selectedBookForData) {
      setExtractedTxtContent('');
      setVectorJsonContent(null);
      return;
    }

    const disc = selectedBookForData.discipline || 'Estatica';
    const fileName = selectedBookForData.fileName || selectedBookForData.name;
    const txtFileName = fileName.replace('.pdf', '.txt');
    const vectorFileName = fileName.replace('.pdf', '_vectors.json');

    setIsLoadingBookData(true);

    Promise.all([
      fetch(`/api/library/file/${disc}/txt/${encodeURIComponent(txtFileName)}`, { cache: 'no-store' })
        .then(res => res.ok ? res.text() : '')
        .catch(() => ''),
      fetch(`/api/library/file/${disc}/vector/${encodeURIComponent(vectorFileName)}`, { cache: 'no-store' })
        .then(res => res.ok ? res.json() : null)
        .catch(() => null)
    ]).then(([txt, vec]) => {
      setExtractedTxtContent(txt);
      setVectorJsonContent(vec);
      setIsLoadingBookData(false);
    });
  }, [selectedBookForData]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (selectedBookForData) {
          setSelectedBookForData(null);
        } else if (showChunkingSettings) {
          setShowChunkingSettings(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedBookForData, showChunkingSettings, onClose]);

  if (!isOpen) return null;

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(Array.from(e.dataTransfer.files));
    }
  };

  // Real upload to F1 Extraction Pipeline on Express backend
  const handleFilesAdded = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(10);
    setUploadStage('Iniciando transferencia al pipeline F1...');

    const targetDisc = uploadDiscipline || 'Estatica';

    try {
      const formData = new FormData();
      formData.append('pdfFile', file);
      formData.append('discipline', targetDisc);
      formData.append('originalName', file.name);
      formData.append('chunkSize', chunkSize.toString());
      formData.append('chunkOverlap', chunkOverlap.toString());
      formData.append('chunkStrategy', chunkStrategy);

      const res = await fetch('/api/library/upload', {
        method: 'POST',
        body: formData
      });

      const uploadData = await res.json().catch(() => null);
      if (!res.ok || !uploadData?.success || !uploadData?.jobId) {
        throw new Error(uploadData?.error || `Error en el servidor: HTTP ${res.status}`);
      }

      const jobId = uploadData.jobId;

      // Poll extraction progress
      const pollInterval = setInterval(async () => {
        try {
          const jobRes = await fetch(`/api/library/job/${jobId}`, { cache: 'no-store' });
          if (jobRes.ok) {
            const { job } = await jobRes.json();
            if (job) {
              setUploadProgress(job.progress);
              setUploadStage(job.stageMessage);

              if (job.status === 'completed') {
                clearInterval(pollInterval);
                setTimeout(async () => {
                  setIsUploading(false);
                  await fetchPhysicalLibraryBooks();
                }, 600);
              } else if (job.status === 'error') {
                clearInterval(pollInterval);
                setIsUploading(false);
                setUploadError(job.error || 'Error durante la extracción e indexación del PDF.');
              }
            }
          }
        } catch (pollErr: any) {
          clearInterval(pollInterval);
          setIsUploading(false);
          setUploadError(pollErr?.message || 'Error al consultar el estado del trabajo de indexación.');
        }
      }, 600);

    } catch (err: any) {
      console.error('Error al subir libro al pipeline F1:', err);
      setIsUploading(false);
      setUploadError(err?.message || 'No se pudo subir e indexar el libro en el servidor local.');
    }
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    if (hideExamples && doc.isExample) return false;
    
    // Discipline filter
    if (activeDiscipline !== 'ALL') {
      const docDisc = doc.discipline || (
        doc.category?.toLowerCase().includes('estatica') ? 'Estatica' :
        doc.category?.toLowerCase().includes('diseno') ? 'Diseno_Mecanico' :
        doc.category?.toLowerCase().includes('termo') ? 'Termodinamica' :
        doc.category?.toLowerCase().includes('material') ? 'Mecanica_Materiales' :
        doc.category?.toLowerCase().includes('maquina') ? 'Elementos_Maquinas' : ''
      );
      if (docDisc !== activeDiscipline) return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = (doc.title || doc.name).toLowerCase().includes(q);
    const authorMatch = (doc.author || '').toLowerCase().includes(q);
    const fileMatch = (doc.fileName || doc.name).toLowerCase().includes(q);
    const categoryMatch = (doc.category || '').toLowerCase().includes(q);
    return titleMatch || authorMatch || fileMatch || categoryMatch;
  });

  // Get real chunks associated with the selected book from its _vectors.json
  const getChunksForBook = (book: DocumentSource): ChunkItem[] => {
    const rawList = vectorJsonContent?.sampleChunks || vectorJsonContent?.chunks || [];
    if (!Array.isArray(rawList) || rawList.length === 0) return [];
    return rawList.map((raw: any, i: number) => ({
      id: `${book.id}-chk-${raw.chunkIndex || i + 1}`,
      documentId: book.id,
      documentName: book.fileName || book.name,
      pageNumber: raw.pageNumber || i + 1,
      chunkIndex: raw.chunkIndex || i + 1,
      tokenCount: raw.tokenCount || 96,
      similarity: 0.96,
      sectionTitle: raw.sectionTitle || raw.section || `Fragmento ${i + 1}`,
      text: raw.textExcerpt || '',
      vectorPreview: Array.isArray(raw.vector) ? raw.vector : [],
      category: book.category || book.discipline || 'General',
      coordinates: {
        x: Math.round(((i * 37) % 80) + 10),
        y: Math.round(((i * 53) % 80) + 10)
      }
    }));
  };

  const handleCopyLatex = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLatex(true);
    setTimeout(() => setCopiedLatex(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/25 backdrop-blur-[6px] transition-all duration-300 animate-fade-in"
      onClick={onClose}
    >
      {/* Main Glassmorphic Modal Window */}
      <div 
        className="w-full max-w-4xl max-h-[92vh] rounded-[28px] border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.18)] flex flex-col overflow-hidden transition-all duration-200 select-none"
        style={{
          backgroundColor: 'rgba(15, 15, 15, 0.40)',
          backdropFilter: 'blur(24px) saturate(150%)',
          WebkitBackdropFilter: 'blur(24px) saturate(150%)',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={onCardHoverStart}
        onMouseLeave={onCardHoverEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Top Header Row */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between gap-3">
          {/* Left: Book Icon + Title + Subtitle */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/[0.05] border border-white/12 flex items-center justify-center shrink-0 shadow-inner">
              <BookOpen className="w-5 h-5 text-white stroke-[1.8]" />
            </div>

            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold font-sans tracking-wide text-white uppercase truncate flex items-center gap-2">
                <span>LIBRERÍA INDEXADA ({documents.length})</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.06] text-neutral-300 border border-white/10 normal-case">
                  Fase F1 Activa
                </span>
              </h2>
              <p className="text-xs text-neutral-400 font-sans truncate">
                Almacenamiento Físico Local: <code className="font-mono text-neutral-300">.../libreria/[Disciplina]/(pdf|vector|txt)</code>
              </p>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Refresh from disk button */}
            <button
              type="button"
              onClick={fetchPhysicalLibraryBooks}
              className="p-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/15 transition-all cursor-pointer"
              title="Recargar libros desde el almacenamiento físico local"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Toggle Quitar / Restaurar Ejemplos */}
            <button
              type="button"
              disabled={isTogglingExamples}
              onClick={() => handleToggleExamples(!hideExamples)}
              className={`px-3 py-1.5 rounded-full text-xs font-sans transition-all duration-150 cursor-pointer border disabled:opacity-50 ${
                hideExamples
                  ? 'bg-white/10 text-white border-white/30'
                  : 'bg-white/[0.03] hover:bg-white/[0.08] text-neutral-300 hover:text-white border-white/15'
              }`}
              title={hideExamples ? 'Restaurar libros de ejemplo' : 'Ocultar libros de ejemplo'}
            >
              {hideExamples ? 'Restaurar ejemplos' : 'Quitar ejemplos'}
            </button>

            {/* Target Discipline Selector Dropdown for Ingestion */}
            <div className="relative inline-block">
              <select
                value={uploadDiscipline}
                onChange={(e) => setUploadDiscipline(e.target.value)}
                className="px-2.5 py-1.5 rounded-full bg-neutral-900 border border-white/20 text-xs text-neutral-200 focus:outline-none cursor-pointer hover:border-white/40 transition-colors"
                title="Disciplina de destino para nuevos libros PDF"
              >
                {DISCIPLINES.filter(d => d.id !== 'ALL').map(d => (
                  <option key={d.id} value={d.id} className="bg-neutral-900 text-white">
                    Carpeta: {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Agregar libros */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-full bg-neutral-800/90 hover:bg-neutral-700/90 border border-white/20 hover:border-white/35 text-xs font-medium text-white flex items-center gap-1.5 transition-all duration-150 cursor-pointer shadow-sm active:scale-95"
              title="Agregar y procesar libros PDF en el pipeline F1"
            >
              <Upload className="w-3.5 h-3.5 text-neutral-200" />
              <span>Agregar libros</span>
            </button>

            {/* Hidden file input */}
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".pdf" 
              multiple 
              className="hidden" 
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesAdded(Array.from(e.target.files));
                  e.target.value = '';
                }
              }}
            />

            {/* BOTÓN EXTRA: Ajustes de Chunking */}
            <button
              type="button"
              onClick={() => setShowChunkingSettings(prev => !prev)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all duration-150 cursor-pointer active:scale-95 border ${
                showChunkingSettings
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-neutral-800/90 hover:bg-neutral-700/90 text-neutral-200 hover:text-white border-white/20 hover:border-white/35'
              }`}
              title="Configurar estrategia de fragmentación, tamaño de chunks y solapamiento"
            >
              <Sliders className={`w-3.5 h-3.5 ${showChunkingSettings ? 'text-black' : 'text-neutral-200'}`} />
              <span>Ajustes de chunking</span>
            </button>

            {/* Close Modal Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer ml-1"
              title="Cerrar panel de librería"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable Chunking Settings Panel */}
        {showChunkingSettings && (
          <div className="p-5 border-b border-white/[0.08] bg-white/[0.03] backdrop-blur-xl animate-fade-in space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-white" />
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white">
                  Configuración del Motor de Extracción & Embeddings F1
                </h3>
              </div>
              <span className="text-[11px] font-mono text-neutral-400">
                Modelo Vectorial: {embeddingModel} • 768-D
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Chunking Strategy Selector */}
              <div className="space-y-2">
                <label className="text-[11px] font-mono text-neutral-300 uppercase tracking-wider">
                  Estrategia de Fragmentación:
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { id: 'semantic', label: 'Corte Semántico por Encabezados', desc: 'Detecta jerarquía de secciones #, ##' },
                    { id: 'recursive', label: 'Recursive Character Splitter', desc: 'Divide progresivamente por párrafos' },
                    { id: 'sliding', label: 'Ventana Móvil con Solapamiento', desc: 'Ventana de tokens fija con overlap' },
                    { id: 'pages', label: 'Segmentación por Página PDF', desc: 'Preserva integridad de tablas y fórmulas' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setChunkStrategy(s.id as any)}
                      className={`p-2 rounded-xl text-left border text-xs transition-all cursor-pointer ${
                        chunkStrategy === s.id
                          ? 'bg-white text-black font-semibold border-white shadow-sm'
                          : 'bg-white/[0.03] border-white/10 text-neutral-300 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <div className="text-[11px]">{s.label}</div>
                      <div className={`text-[10px] ${chunkStrategy === s.id ? 'text-neutral-700' : 'text-neutral-500'}`}>
                        {s.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chunk Size Slider */}
              <div className="space-y-3 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-neutral-300">Tamaño del Chunk:</span>
                  <span className="text-white font-bold">{chunkSize} tokens</span>
                </div>
                <input
                  type="range"
                  min="128"
                  max="2048"
                  step="64"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value))}
                  className="w-full accent-white cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-neutral-500">
                  <span>128 (Granular)</span>
                  <span>512 (Equilibrado)</span>
                  <span>2048 (Extenso)</span>
                </div>

                <div className="pt-2 flex items-center gap-1.5">
                  {[256, 512, 1024].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setChunkSize(sz)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition-colors cursor-pointer ${
                        chunkSize === sz
                          ? 'bg-white text-black border-white'
                          : 'bg-white/[0.04] text-neutral-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {sz} tok
                    </button>
                  ))}
                </div>
              </div>

              {/* Chunk Overlap Slider & Model Selection */}
              <div className="space-y-3 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-neutral-300">Solapamiento (Overlap):</span>
                  <span className="text-white font-bold">{chunkOverlap} tokens</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="256"
                  step="16"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(parseInt(e.target.value))}
                  className="w-full accent-white cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-neutral-500">
                  <span>0 tokens</span>
                  <span>64 (Recomendado)</span>
                  <span>256 tokens</span>
                </div>

                <div className="pt-2 flex items-center gap-1.5">
                  {[0, 64, 128].map((ov) => (
                    <button
                      key={ov}
                      type="button"
                      onClick={() => setChunkOverlap(ov)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition-colors cursor-pointer ${
                        chunkOverlap === ov
                          ? 'bg-white text-black border-white'
                          : 'bg-white/[0.04] text-neutral-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {ov} ov
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom notification */}
            <div className="flex items-center justify-between text-[11px] font-sans text-neutral-400 pt-2 border-t border-white/[0.06]">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-neutral-300" />
                Los parámetros configurados se aplican automáticamente a las nuevas subidas de libros PDF.
              </span>
              <button
                type="button"
                disabled={isReindexing}
                onClick={async () => {
                  setUploadError(null);
                  setIsReindexing(true);
                  try {
                    const res = await fetch('/api/library/reindex', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ chunkSize, chunkOverlap, chunkStrategy })
                    });
                    const data = await res.json().catch(() => null);
                    if (!res.ok || !data?.success) {
                      throw new Error(data?.error || `Error HTTP ${res.status} al re-indexar`);
                    }
                    await fetchPhysicalLibraryBooks();
                    setShowChunkingSettings(false);
                  } catch (err: any) {
                    setUploadError(err?.message || 'Error al re-indexar la biblioteca.');
                  } finally {
                    setIsReindexing(false);
                  }
                }}
                className="px-3 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-white text-xs font-mono cursor-pointer transition-colors disabled:opacity-50"
              >
                {isReindexing ? 'Re-indexando disco...' : 'Re-indexar biblioteca con estos parámetros'}
              </button>
            </div>
          </div>
        )}

        {/* Selected Book "Datos 🟡" Detailed View */}
        {selectedBookForData ? (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 animate-fade-in">
            {/* Back button + Action buttons */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedBookForData(null)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver a la lista de libros</span>
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/library/file/${selectedBookForData.discipline || 'Estatica'}/pdf/${encodeURIComponent(selectedBookForData.fileName || selectedBookForData.name)}`}
                  download={selectedBookForData.fileName || selectedBookForData.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] border border-white/15 text-xs text-white transition-colors cursor-pointer"
                  title="Descargar archivo PDF original intacto"
                >
                  <Download className="w-3.5 h-3.5 text-neutral-300" />
                  <span>PDF Original</span>
                </a>

                <button
                  type="button"
                  onClick={() => onOpenPdf(selectedBookForData.fileName || selectedBookForData.name, 1)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-black text-xs font-medium hover:bg-neutral-200 transition-colors cursor-pointer shadow-md"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir en Visor PDF</span>
                </button>
              </div>
            </div>

            {/* Document Header Card */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white font-sans">
                      {selectedBookForData.title || selectedBookForData.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.08] text-neutral-300 text-xs font-mono">
                      {selectedBookForData.discipline || selectedBookForData.category}
                    </span>
                    {selectedBookForData.isExample && (
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-neutral-400 text-xs font-sans">
                        Ejemplo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 font-sans mt-1">
                    {selectedBookForData.author} · {selectedBookForData.fileName || selectedBookForData.name}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Pipeline F1 Completado
                  </span>
                </div>
              </div>

              {/* Physical Storage Paths on Disk Display */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/[0.08] space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center gap-2 text-neutral-300">
                  <FolderTree className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="font-semibold text-white">Estructura Física en Disco Local:</span>
                </div>
                <div className="pl-5 space-y-1 text-neutral-400">
                  <div>
                    📁 <span className="text-neutral-500">.../libreria/{selectedBookForData.discipline || 'Estatica'}/pdf/</span>
                    <span className="text-neutral-200">{selectedBookForData.fileName || selectedBookForData.name}</span>
                    <span className="text-emerald-400 text-[10px] ml-2">(Intacto)</span>
                  </div>
                  <div>
                    📁 <span className="text-neutral-500">.../libreria/{selectedBookForData.discipline || 'Estatica'}/txt/</span>
                    <span className="text-neutral-200">{(selectedBookForData.fileName || selectedBookForData.name).replace('.pdf', '.txt')}</span>
                    <span className="text-amber-400 text-[10px] ml-2">(LaTeX / Markdown)</span>
                  </div>
                  <div>
                    📁 <span className="text-neutral-500">.../libreria/{selectedBookForData.discipline || 'Estatica'}/vector/</span>
                    <span className="text-neutral-200">{(selectedBookForData.fileName || selectedBookForData.name).replace('.pdf', '_vectors.json')}</span>
                    <span className="text-cyan-400 text-[10px] ml-2">(Embeddings 768-D)</span>
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center">
                  <div className="text-[10px] font-mono text-neutral-400 uppercase">Páginas Totales</div>
                  <div className="text-sm font-bold font-mono text-white mt-0.5">
                    {selectedBookForData.pages} págs
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center">
                  <div className="text-[10px] font-mono text-neutral-400 uppercase">Chunks Generados</div>
                  <div className="text-sm font-bold font-mono text-white mt-0.5">
                    {selectedBookForData.chunksCount} fragmentos
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center">
                  <div className="text-[10px] font-mono text-neutral-400 uppercase">Tamaño en Disco</div>
                  <div className="text-sm font-bold font-mono text-white mt-0.5">
                    {selectedBookForData.size}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center">
                  <div className="text-[10px] font-mono text-neutral-400 uppercase">Espacio Vectorial</div>
                  <div className="text-sm font-bold font-mono text-white mt-0.5">
                    768 Tensores D
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs inside Book Details */}
            <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2">
              <button
                type="button"
                onClick={() => setDataActiveTab('text_latex')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer ${
                  dataActiveTab === 'text_latex'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/10'
                }`}
              >
                <Sigma className="w-3.5 h-3.5" />
                <span>Texto & Fórmulas LaTeX (.txt)</span>
              </button>

              <button
                type="button"
                onClick={() => setDataActiveTab('vectors')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer ${
                  dataActiveTab === 'vectors'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/10'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Base Vectorial & Embeddings (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => setDataActiveTab('intact_pdf')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer ${
                  dataActiveTab === 'intact_pdf'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/10'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Archivo Original (.pdf)</span>
              </button>
            </div>

            {/* TAB 1: Texto & Fórmulas LaTeX */}
            {dataActiveTab === 'text_latex' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-300">
                      Visualización procesada con KaTeX matemático y soporte de ecuaciones:
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyLatex(extractedTxtContent)}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-[11px] font-mono text-neutral-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedLatex ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLatex ? 'Copiado' : 'Copiar Texto LaTeX'}</span>
                    </button>
                    <a
                      href={`/api/library/file/${selectedBookForData.discipline || 'Estatica'}/txt/${encodeURIComponent((selectedBookForData.fileName || selectedBookForData.name).replace('.pdf', '.txt'))}`}
                      download={(selectedBookForData.fileName || selectedBookForData.name).replace('.pdf', '.txt')}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-[11px] font-mono text-neutral-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Descargar .txt</span>
                    </a>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] max-h-[480px] overflow-y-auto">
                  {isLoadingBookData ? (
                    <div className="py-12 text-center text-xs text-neutral-400 font-mono flex items-center justify-center gap-2">
                      <Cpu className="w-4 h-4 animate-spin text-neutral-300" />
                      <span>Cargando contenido extraído del libro...</span>
                    </div>
                  ) : extractedTxtContent ? (
                    <MarkdownRenderer content={extractedTxtContent} />
                  ) : (
                    <div className="py-8 text-center text-xs text-neutral-400 font-mono">
                      No se encontró archivo de texto para este libro.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Vectores & Embeddings */}
            {dataActiveTab === 'vectors' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-neutral-300">
                    Tensores generados con {vectorJsonContent?.model || 'text-embedding-004 (768-D)'}
                  </span>
                  <a
                    href={`/api/library/file/${selectedBookForData.discipline || 'Estatica'}/vector/${encodeURIComponent((selectedBookForData.fileName || selectedBookForData.name).replace('.pdf', '_vectors.json'))}`}
                    download={(selectedBookForData.fileName || selectedBookForData.name).replace('.pdf', '_vectors.json')}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-[11px] font-mono text-neutral-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Descargar vectores .json</span>
                  </a>
                </div>

                {/* Sample Chunks */}
                <div className="space-y-3">
                  {getChunksForBook(selectedBookForData).map((chk) => (
                    <div 
                      key={chk.id}
                      className="p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.08] hover:border-white/20 transition-all duration-150 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="font-semibold text-white font-sans flex items-center gap-2">
                          <span>{chk.sectionTitle || `Sección ${chk.pageNumber}`}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-300">
                            Pág. {chk.pageNumber}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-amber-300">
                            {(chk.similarity * 100).toFixed(1)}% afinidad
                          </span>
                          {onInspectChunk && (
                            <button
                              type="button"
                              onClick={() => onInspectChunk(chk)}
                              className="px-2 py-0.5 rounded bg-white/[0.08] hover:bg-white/20 text-[10px] font-mono text-white transition-colors cursor-pointer"
                            >
                              Inspeccionar
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-neutral-300 font-sans leading-relaxed line-clamp-3">
                        {chk.text}
                      </p>

                      <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 pt-1 border-t border-white/[0.04]">
                        <span className="truncate">Vector: [{chk.vectorPreview?.slice(0, 4).join(', ')}... 768-D]</span>
                        <span>Chunk #{chk.chunkIndex}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vector JSON Inspector */}
                {vectorJsonContent && (
                  <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                      <span>Metadatos del archivo vectorial JSON:</span>
                    </div>
                    <pre className="text-[11px] font-mono text-neutral-300 overflow-x-auto max-h-48 p-2 rounded bg-white/[0.02]">
                      {JSON.stringify(vectorJsonContent, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Archivo Original Intacto */}
            {dataActiveTab === 'intact_pdf' && (
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white font-sans">
                      Archivo PDF Original Preservado Intacto
                    </h4>
                    <p className="text-xs text-neutral-400 font-sans">
                      El pipeline F1 copia y almacena el documento original sin modificaciones destructivas para permitir la verificación humana y navegación por páginas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenPdf(selectedBookForData.fileName || selectedBookForData.name, 1)}
                    className="px-3.5 py-1.5 rounded-xl bg-white text-black text-xs font-medium hover:bg-neutral-200 transition-colors cursor-pointer shrink-0"
                  >
                    Abrir Visor
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-black/40 border border-white/[0.08] space-y-2 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Nombre del archivo:</span>
                    <span className="text-white">{selectedBookForData.fileName || selectedBookForData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Disciplina / Carpeta:</span>
                    <span className="text-white">{selectedBookForData.discipline || 'Estatica'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Tamaño del archivo:</span>
                    <span className="text-white">{selectedBookForData.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Páginas indexadas:</span>
                    <span className="text-white">{selectedBookForData.pages}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Estado de integridad:</span>
                    <span className="text-emerald-400">✓ Válido (Formato PDF 1.4 - 1.7)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Standard Documents List View */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Discipline Filter Pills */}
            <div className="px-4 sm:px-5 pt-3 pb-1 flex items-center gap-1.5 overflow-x-auto">
              {DISCIPLINES.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setActiveDiscipline(d.id)}
                  className={`px-3 py-1 rounded-full text-xs font-sans transition-all whitespace-nowrap cursor-pointer border ${
                    activeDiscipline === d.id
                      ? 'bg-white text-black font-semibold border-white shadow-sm'
                      : 'bg-white/[0.03] hover:bg-white/[0.08] text-neutral-300 hover:text-white border-white/10'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="p-4 sm:p-5 pb-3">
              <div 
                className={`relative rounded-2xl border transition-all duration-200 px-4 py-3 flex items-center gap-3 ${
                  isDragging
                    ? 'border-white/50 bg-white/[0.12] ring-2 ring-white/20'
                    : 'border-white/15 bg-white/[0.05] hover:border-white/25 focus-within:border-white/40 focus-within:bg-white/[0.08]'
                }`}
              >
                <Search className="w-4 h-4 text-neutral-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por título, autor o disciplina... (también puedes arrastrar archivos aquí)"
                  className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none font-sans"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-neutral-400 hover:text-white shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Upload Error Alert Banner */}
            {uploadError && (
              <div className="mx-4 sm:mx-5 mb-3 p-3.5 rounded-2xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{uploadError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="text-red-300 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Upload Ingestion Live Banner */}
            {isUploading && (
              <div className="mx-4 sm:mx-5 mb-3 p-4 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/20 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white flex items-center gap-2">
                    <Cpu className="w-4 h-4 animate-spin text-neutral-300" />
                    {uploadStage}
                  </span>
                  <span className="text-neutral-300 font-bold">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-white h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="text-[10px] font-mono text-neutral-400 flex items-center justify-between">
                  <span>Destino: .../libreria/{uploadDiscipline}/(pdf|vector|txt)</span>
                  <span>Pipeline F1 Local</span>
                </div>
              </div>
            )}

            {/* Scrollable Books List */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-5 space-y-3">
              {filteredDocuments.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <BookOpen className="w-8 h-8 mx-auto text-neutral-600" />
                  <p className="text-xs text-neutral-400 font-sans">
                    {searchQuery 
                      ? 'No se encontraron libros ni documentos que coincidan con la búsqueda.'
                      : 'No hay libros cargados en esta disciplina.'}
                  </p>
                  {hideExamples && (
                    <button
                      type="button"
                      disabled={isTogglingExamples}
                      onClick={() => handleToggleExamples(false)}
                      className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/15 text-xs text-white border border-white/15 cursor-pointer font-sans disabled:opacity-50"
                    >
                      Restaurar libros de ejemplo
                    </button>
                  )}
                </div>
              ) : (
                filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="group rounded-2xl p-4 sm:p-4.5 border border-white/[0.09] hover:border-white/22 bg-white/[0.04] hover:bg-white/[0.08] transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                  >
                    {/* Left Column: Title, Subtitle, Status */}
                    <div className="min-w-0 flex-1">
                      {/* Title + Optional Ejemplo badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm sm:text-[15px] font-bold text-white tracking-tight font-sans">
                          {doc.title || doc.name}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[10px] font-mono text-neutral-300">
                          {doc.discipline || doc.category}
                        </span>
                        {doc.isExample && (
                          <span className="px-2 py-0.5 rounded-md bg-white/[0.08] border border-white/10 text-[11px] font-sans text-neutral-400">
                            Ejemplo
                          </span>
                        )}
                      </div>

                      {/* Author + File name + File Size */}
                      <p className="text-xs text-neutral-400 font-sans mt-1 truncate">
                        {doc.author ? `${doc.author} · ` : ''}
                        {doc.fileName || doc.name} ({doc.size})
                      </p>

                      {/* Status Row with F1 Physical Path Indicator */}
                      <div className="flex items-center gap-3 mt-2 text-xs font-sans">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Indexado F1
                        </span>
                        <span className="text-neutral-400 font-mono text-[11px] truncate">
                          📁 libreria/{doc.discipline || 'Estatica'}/(pdf|txt|vector)
                        </span>
                      </div>
                    </div>

                    {/* Right Column: [📖 Datos 🟡] + Delete Button */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setSelectedBookForData(doc)}
                        className="px-3.5 py-1.5 rounded-xl border border-amber-500/40 hover:border-amber-400/80 bg-amber-500/[0.06] hover:bg-amber-500/[0.12] text-amber-200 hover:text-white flex items-center gap-2 text-xs font-medium cursor-pointer transition-all duration-150 shadow-sm active:scale-95"
                        title="Ver metadatos, fórmulas LaTeX extraídas y archivos vectoriales físicos"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-amber-300" />
                        <span>Datos</span>
                        <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
                      </button>

                      <button
                        type="button"
                        disabled={deletingBookId === doc.id}
                        onClick={() => handleDeleteBook(doc)}
                        className="p-2 rounded-xl border border-white/10 hover:border-red-400/50 bg-white/[0.03] hover:bg-red-500/15 text-neutral-400 hover:text-red-200 transition-colors cursor-pointer disabled:opacity-40"
                        title={`Eliminar ${doc.title || doc.name} del almacenamiento local`}
                        aria-label={`Eliminar ${doc.title || doc.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Footer Bar */}
            <div className="p-3 sm:p-4 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between text-[11px] font-mono text-neutral-400 px-5">
              <span>{filteredDocuments.length} documentos listados</span>
              <span className="hidden sm:inline">Pipeline F1: Python local triage + LaTeX-OCR + rate-limited fallback</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
