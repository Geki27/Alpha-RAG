import React, { useState } from 'react';
import { 
  FileText, 
  Upload, 
  Plus, 
  CheckCircle, 
  Clock, 
  Layers, 
  Sliders, 
  Trash2, 
  ExternalLink, 
  Sparkles, 
  AlertCircle,
  FileUp,
  Cpu,
  BookOpen
} from 'lucide-react';
import { DocumentSource } from '../types/rag';
import { ChunkStrategyType } from '../types/settings';

interface DocumentLibraryProps {
  onOpenPdf: (docName: string, page: number) => void;
  onCardHoverStart: () => void;
  onCardHoverEnd: () => void;
  documents?: DocumentSource[];
  setDocuments?: React.Dispatch<React.SetStateAction<DocumentSource[]>>;
  onRefreshBooks?: () => Promise<void> | void;
  onOpenLibraryModal?: () => void;
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
}

const LIBRARY_DISCIPLINES = [
  { id: 'Estatica', label: 'Estática' },
  { id: 'Diseno_Mecanico', label: 'Diseño Mecánico' },
  { id: 'Termodinamica', label: 'Termodinámica' },
  { id: 'Mecanica_Materiales', label: 'Mecánica de Materiales' },
  { id: 'Elementos_Maquinas', label: 'Elementos de Máquinas' }
];

export const DocumentLibrary: React.FC<DocumentLibraryProps> = ({
  onOpenPdf,
  onCardHoverStart,
  onCardHoverEnd,
  documents: externalDocs,
  onRefreshBooks,
  onOpenLibraryModal,
  hideExamples = false,
  onToggleHideExamples,
  chunkStrategy: chunkStrategyProp,
  onChangeChunkStrategy,
  chunkSize: chunkSizeProp,
  onChangeChunkSize,
  chunkOverlap: chunkOverlapProp,
  onChangeChunkOverlap,
  uploadDiscipline: uploadDisciplineProp,
  onChangeUploadDiscipline,
}) => {
  const documents = externalDocs || [];
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [internalUploadDiscipline, setInternalUploadDiscipline] = useState<string>('Estatica');
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);

  // Chunking Strategy Settings (backed by persistent App/server settings when provided)
  const [internalChunkSize, setInternalChunkSize] = useState<number>(512);
  const [internalChunkOverlap, setInternalChunkOverlap] = useState<number>(64);
  const [internalChunkStrategy, setInternalChunkStrategy] = useState<ChunkStrategyType>('semantic');

  const uploadDiscipline = uploadDisciplineProp ?? internalUploadDiscipline;
  const setUploadDiscipline = (val: string) => {
    setInternalUploadDiscipline(val);
    onChangeUploadDiscipline?.(val);
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

  const chunkStrategy = chunkStrategyProp ?? internalChunkStrategy;
  const setChunkStrategy = (val: ChunkStrategyType) => {
    setInternalChunkStrategy(val);
    onChangeChunkStrategy?.(val);
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
      if (onRefreshBooks) {
        await onRefreshBooks();
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Error al eliminar el libro.');
    } finally {
      setDeletingBookId(null);
    }
  };

  const handleRealUpload = async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(10);
    setUploadStage('1/4: Transfiriendo PDF al servidor local...');

    try {
      const formData = new FormData();
      formData.append('pdfFile', file);
      formData.append('discipline', uploadDiscipline);
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
        throw new Error(uploadData?.error || `Error HTTP ${res.status} al subir el PDF`);
      }

      const jobId = uploadData.jobId;
      const pollInterval = setInterval(async () => {
        try {
          const jobRes = await fetch(`/api/library/job/${jobId}`, { cache: 'no-store' });
          if (!jobRes.ok) return;
          const { job } = await jobRes.json();
          if (!job) return;

          setUploadProgress(job.progress);
          setUploadStage(job.stageMessage);

          if (job.status === 'completed') {
            clearInterval(pollInterval);
            setIsUploading(false);
            if (onRefreshBooks) await onRefreshBooks();
          } else if (job.status === 'error') {
            clearInterval(pollInterval);
            setIsUploading(false);
            setUploadError(job.error || 'Error extrayendo el archivo PDF.');
          }
        } catch (pollErr: any) {
          clearInterval(pollInterval);
          setIsUploading(false);
          setUploadError(pollErr?.message || 'Error consultando el estado de indexación.');
        }
      }, 600);
    } catch (err: any) {
      setIsUploading(false);
      setUploadError(err?.message || 'Error al subir e indexar el archivo PDF.');
    }
  };

  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
      
      {/* Header Banner */}
      <div 
        className="glass-panel rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass-panel-hover"
        onMouseEnter={onCardHoverStart}
        onMouseLeave={onCardHoverEnd}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white">
            <FileText className="w-5 h-5 text-neutral-300" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-wide text-white font-mono uppercase">
              Biblioteca de Documentos PDF & Ingestión Vectorial
            </h2>
            <p className="text-xs text-neutral-400">
              Administra el corpus documental, configura las estrategias de partición (chunking) e indexa nuevos archivos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={uploadDiscipline}
            onChange={(e) => setUploadDiscipline(e.target.value)}
            className="px-3 py-2 rounded-xl bg-neutral-900 border border-white/15 text-xs text-neutral-200 focus:outline-none cursor-pointer"
            title="Disciplina de destino en /libreria/"
          >
            {LIBRARY_DISCIPLINES.map(d => (
              <option key={d.id} value={d.id} className="bg-neutral-900 text-white">
                Carpeta: {d.label}
              </option>
            ))}
          </select>

          {onToggleHideExamples && (
            <button
              type="button"
              onClick={() => onToggleHideExamples(!hideExamples)}
              className={`px-3 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                hideExamples
                  ? 'bg-white text-black border-white'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-neutral-200 border-white/15'
              }`}
              title={hideExamples ? 'Restaurar libros de ejemplo' : 'Ocultar libros de ejemplo'}
            >
              {hideExamples ? 'Restaurar ejemplos' : 'Quitar ejemplos'}
            </button>
          )}

          {onOpenLibraryModal && (
            <button
              onClick={onOpenLibraryModal}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/15 text-xs font-medium transition-colors cursor-pointer"
              title="Abrir panel flotante z-index de la librería"
            >
              <BookOpen className="w-3.5 h-3.5 text-white" />
              <span>Ver Panel Flotante</span>
            </button>
          )}
          <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-medium hover:bg-neutral-200 transition-colors cursor-pointer shadow-lg shadow-white/10">
            <Plus className="w-4 h-4" />
            <span>Subir PDF</span>
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleRealUpload(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
          </label>
        </div>
      </div>

      {/* Upload Zone & Chunking Config Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* PDF Dropzone */}
        <div 
          className="lg:col-span-7 glass-panel rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden"
          onMouseEnter={onCardHoverStart}
          onMouseLeave={onCardHoverEnd}
        >
          <div className="mb-4">
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
              Ingestión de Documentos
            </span>
          </div>

          <label
            className="relative border-2 border-dashed border-white/15 hover:border-white/40 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 bg-white/[0.01] hover:bg-white/[0.04] group"
          >
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleRealUpload(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
            <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/15 flex items-center justify-center text-white mb-3 group-hover:scale-110 group-hover:border-white/30 transition-all duration-300">
              <FileUp className="w-6 h-6 text-neutral-300" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">
              Arrastra y suelta tu archivo PDF aquí
            </h3>
            <p className="text-xs text-neutral-400 max-w-sm mb-3">
              Formatos aceptados: Documentos PDF (nativo o escaneado con OCR). Se guardará en /libreria/{uploadDiscipline}.
            </p>
            <span className="px-3 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] font-mono text-neutral-300">
              Examinar archivos en tu equipo
            </span>
          </label>

          {/* Upload Progress Bar if active */}
          {isUploading && (
            <div className="mt-4 p-4 rounded-xl bg-black/80 border border-white/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 animate-spin" />
                  {uploadStage}
                </span>
                <span className="text-neutral-400">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-white h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {uploadError && (
            <div className="mt-4 p-3.5 rounded-xl bg-red-950/50 border border-red-500/40 text-xs text-red-200 flex items-center gap-2 font-sans">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 pt-3">
            <span>Cifrado en reposo AES-256 • Indexación HNSW instantánea</span>
            <span>Motor Vectorial F0</span>
          </div>
        </div>

        {/* Chunking Strategy Configuration */}
        <div 
          className="lg:col-span-5 glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-5"
          onMouseEnter={onCardHoverStart}
          onMouseLeave={onCardHoverEnd}
        >
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-neutral-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-300">
                  Configuración de Chunking
                </span>
              </div>
              <span className="text-[10px] font-mono text-neutral-500">
                Segmentación
              </span>
            </div>

            {/* Chunk Strategy Select */}
            <div className="space-y-2 mb-4">
              <label className="text-xs font-mono text-neutral-300">
                Estrategia de Fragmentación:
              </label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'semantic', label: 'Corte Semántico por Encabezados', desc: 'Detecta jerarquía de secciones del PDF' },
                  { id: 'recursive', label: 'Recursive Character Splitter', desc: 'Divide progresivamente por párrafos y frases' },
                  { id: 'sliding', label: 'Ventana Móvil con Solapamiento', desc: 'Ventana rígida con overlap garantizado' },
                ].map((strat) => (
                  <button
                    key={strat.id}
                    onClick={() => setChunkStrategy(strat.id as ChunkStrategyType)}
                    className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
                      chunkStrategy === strat.id
                        ? 'bg-white/[0.08] border-white/40 text-white'
                        : 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="font-medium text-white">{strat.label}</div>
                    <div className="text-[11px] text-neutral-400">{strat.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-4 pt-1">
              <div>
                <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                  <span className="text-neutral-300">Tamaño del Chunk (Tokens):</span>
                  <span className="text-white font-semibold">{chunkSize} tokens</span>
                </div>
                <input
                  type="range"
                  min="128"
                  max="1024"
                  step="64"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value))}
                  className="w-full accent-white cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-neutral-500 mt-1">
                  <span>128 (Granular)</span>
                  <span>512 (Equilibrado)</span>
                  <span>1024 (Amplio)</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                  <span className="text-neutral-300">Solapamiento / Overlap:</span>
                  <span className="text-white font-semibold">{chunkOverlap} tokens</span>
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
                <div className="flex justify-between text-[10px] font-mono text-neutral-500 mt-1">
                  <span>0 tokens</span>
                  <span>64 tokens</span>
                  <span>256 tokens</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06] text-[11px] font-mono text-neutral-400 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-neutral-300" />
            <span>Configuración activa aplicada a próximas ingestas</span>
          </div>
        </div>

      </div>

      {/* Indexed Documents Table */}
      <div 
        className="glass-panel rounded-2xl p-6 space-y-4"
        onMouseEnter={onCardHoverStart}
        onMouseLeave={onCardHoverEnd}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-neutral-400" />
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-300">
              Corpus de Documentos Indexados ({documents.length})
            </span>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">
            Total Chunks Activos: {documents.reduce((acc, d) => acc + d.chunksCount, 0)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] font-mono text-neutral-400 uppercase">
                <th className="pb-3 font-medium">Documento</th>
                <th className="pb-3 font-medium">Categoría</th>
                <th className="pb-3 font-medium">Páginas</th>
                <th className="pb-3 font-medium">Chunks</th>
                <th className="pb-3 font-medium">Tamaño</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {documents.map((doc) => (
                <tr 
                  key={doc.id}
                  className="group hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
                        <FileText className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-white group-hover:text-neutral-200">
                          {doc.name}
                        </div>
                        <div className="text-[10px] text-neutral-500 font-mono">
                          {doc.author} • {doc.uploadDate}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="px-2 py-0.5 rounded bg-white/[0.05] border border-white/10 text-[10px] font-mono text-neutral-300">
                      {doc.category}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4 font-mono text-neutral-300">
                    {doc.pages} págs
                  </td>
                  <td className="py-3.5 pr-4 font-mono text-neutral-300">
                    {doc.chunksCount}
                  </td>
                  <td className="py-3.5 pr-4 font-mono text-neutral-400">
                    {doc.size}
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.05] text-[10px] font-mono text-neutral-300 border border-white/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      Indexado
                    </span>
                  </td>
                  <td className="py-3.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenPdf(doc.fileName || doc.name, 1)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-neutral-300 hover:text-white border border-white/10 text-[11px] font-mono transition-colors cursor-pointer"
                      >
                        <span>Abrir</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingBookId === doc.id}
                        onClick={() => handleDeleteBook(doc)}
                        className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-red-500/15 text-neutral-400 hover:text-red-200 border border-white/10 hover:border-red-400/50 transition-colors cursor-pointer disabled:opacity-40"
                        title={`Eliminar ${doc.name} del disco`}
                        aria-label={`Eliminar ${doc.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
