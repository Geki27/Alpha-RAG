import React from 'react';
import { 
  X, 
  Layers, 
  FileText, 
  ExternalLink, 
  Copy, 
  Check, 
  Globe,
  Compass,
  ShieldCheck,
  BookOpen
} from 'lucide-react';
import { GroundedCitation, ChunkItem } from '../types/rag';
import { SAMPLE_CHUNKS } from '../data/mockRagData';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ContextInspectorModalProps {
  citation: GroundedCitation | null;
  chunk: ChunkItem | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenPdf: (docName: string, page: number) => void;
}

export const ContextInspectorModal: React.FC<ContextInspectorModalProps> = ({
  citation,
  chunk,
  isOpen,
  onClose,
  onOpenPdf,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [copiedUrl, setCopiedUrl] = React.useState(false);

  if (!isOpen) return null;

  // Resolve chunk data either from chunk or citation
  const activeChunk = chunk || (citation ? SAMPLE_CHUNKS.find(c => c.id === citation.chunkId) || SAMPLE_CHUNKS[0] : SAMPLE_CHUNKS[0]);
  const docName = citation?.documentName || activeChunk.documentName;
  const pageNum = citation?.pageNumber || activeChunk.pageNumber;
  const simScore = citation?.similarityScore || activeChunk.similarity;
  const textContent = citation?.excerpt || activeChunk.text || '';
  const isWeb = citation?.type === 'web' || Boolean(citation?.url);
  const webUrl = citation?.url;
  const domain = citation?.domain || (webUrl ? new URL(webUrl).hostname.replace(/^www\./, '') : 'web');

  const handleCopy = () => {
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyUrl = () => {
    if (webUrl) {
      navigator.clipboard.writeText(webUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/25 backdrop-blur-[6px] transition-all duration-300 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl rounded-[28px] border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.18)] p-6 space-y-5 select-none transition-all duration-200"
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
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
              isWeb 
                ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300' 
                : 'bg-white/[0.05] border-white/10 text-neutral-300'
            }`}>
              {isWeb ? (
                <Globe className="w-4 h-4 text-cyan-300" />
              ) : (
                <Layers className="w-4 h-4 text-neutral-300" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wide flex items-center gap-2">
                <span>{isWeb ? 'Fuente Web & Norma de Ingeniería' : 'Inspección de Chunk & Afinidad Vectorial'}</span>
                {isWeb && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 normal-case font-mono">
                    Grounded Web
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono">
                {isWeb 
                  ? 'Recurso industrial normalizado verificado mediante Google Search & catálogo oficial'
                  : 'Fragmento recuperado por búsqueda HNSW en base vectorial local'}
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

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-center">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">
              {isWeb ? 'Afinidad / Relevancia' : 'Similitud Coseno'}
            </div>
            <div className={`text-sm font-bold font-mono mt-0.5 ${isWeb ? 'text-cyan-300' : 'text-white'}`}>
              {(simScore * 100).toFixed(1)}%
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-center">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">
              {isWeb ? 'Dominio Verificado' : 'Página en PDF'}
            </div>
            <div className="text-sm font-bold font-mono text-white mt-0.5 truncate px-1">
              {isWeb ? domain : `Página ${pageNum}`}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-center">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">
              {isWeb ? 'Tipo de Registro' : 'Tokens Estimados'}
            </div>
            <div className="text-sm font-bold font-mono text-white mt-0.5">
              {isWeb ? 'Norma / Catálogo' : `${activeChunk.tokenCount || 78} tokens`}
            </div>
          </div>
        </div>

        {/* Source Link / Document Row */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono text-neutral-400 uppercase">
            {isWeb ? 'Recurso Web Normalizado:' : 'Documento de Procedencia:'}
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/10 text-xs text-white font-mono">
            <span className="truncate pr-2 font-sans font-medium text-neutral-200">{docName}</span>
            {isWeb ? (
              <span className="text-cyan-300 text-[11px] shrink-0 font-mono px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                {domain}
              </span>
            ) : (
              <span className="text-neutral-400 shrink-0">Chunk #{activeChunk.chunkIndex || 42}</span>
            )}
          </div>
          {isWeb && webUrl && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono text-neutral-400">
              <span className="truncate text-cyan-300/80 mr-2">{webUrl}</span>
              <button
                onClick={handleCopyUrl}
                className="text-[10px] text-neutral-300 hover:text-white flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copiedUrl ? <Check className="w-3 h-3 text-cyan-300" /> : <Copy className="w-3 h-3" />}
                <span>{copiedUrl ? 'Copiada' : 'Copiar URL'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Text Excerpt / Snippet with LaTeX support */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
            <span className="flex items-center gap-1">
              <span>{isWeb ? 'EXTRACTO DE LA NORMA / DOCUMENTO TÉCNICO' : 'CONTENIDO EXTRACTO DEL CHUNK'}</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-white/[0.08] text-neutral-300">
                {isWeb ? 'Web / LaTeX' : '.md'}
              </span>
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copiado' : 'Copiar Texto'}</span>
            </button>
          </div>
          <div className="p-4 rounded-xl bg-black/70 border border-white/15 text-xs text-neutral-200 leading-relaxed max-h-52 overflow-y-auto font-sans selection:bg-white selection:text-black">
            <MarkdownRenderer content={textContent} />
          </div>
        </div>

        {/* Vector Snapshot Preview */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono text-neutral-400 uppercase">
            {isWeb ? 'Vector Embedding de la Consulta & Afinidad Semántica:' : 'Vector Embedding (Primeros 8 Tensores):'}
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/10 font-mono text-[11px] text-neutral-400 grid grid-cols-4 gap-2 text-center">
            {(activeChunk.vectorPreview || [0.0821, -0.421, 0.7712, 0.1294, -0.0418, 0.5129, 0.3391, -0.2184]).map((val, idx) => (
              <div key={idx} className="bg-black/40 py-1 rounded border border-white/5 text-neutral-300">
                {val > 0 ? `+${val.toFixed(4)}` : val.toFixed(4)}
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-mono text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          {isWeb && webUrl ? (
            <button
              onClick={() => {
                window.open(webUrl, '_blank', 'noopener,noreferrer');
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-400 text-black text-xs font-semibold hover:bg-cyan-300 transition-colors shadow-lg cursor-pointer"
            >
              <span>Abrir Enlace Web / Documentación</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => {
                onClose();
                onOpenPdf(docName, pageNum);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-xs font-medium hover:bg-neutral-200 transition-colors shadow-lg cursor-pointer"
            >
              <span>Ver Página en Visor PDF</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

