import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Download, 
  Cpu
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentName: string;
  initialPage?: number;
}

interface ParsedPage {
  pageNumber: number;
  content: string;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  onClose,
  documentName,
  initialPage = 1,
}) => {
  const [page, setPage] = useState<number>(initialPage);
  const [zoom, setZoom] = useState<number>(100);
  const [pagesContent, setPagesContent] = useState<ParsedPage[]>([]);
  const [discipline, setDiscipline] = useState<string>('Estatica');
  const [resolvedFileName, setResolvedFileName] = useState<string>(documentName);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage, documentName]);

  useEffect(() => {
    if (!isOpen || !documentName) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    fetch('/api/library/books')
      .then(res => res.json())
      .then(async (data) => {
        if (cancelled) return;
        const books = Array.isArray(data?.books) ? data.books : [];
        const normDoc = documentName.toLowerCase();
        const matchedBook = books.find((b: any) =>
          (b.fileName || '').toLowerCase() === normDoc ||
          (b.title || '').toLowerCase() === normDoc ||
          (b.fileName || '').toLowerCase().includes(normDoc.replace(/\.pdf$/i, ''))
        );

        const targetDisc = matchedBook?.discipline || 'Estatica';
        const targetFile = matchedBook?.fileName || documentName;
        setDiscipline(targetDisc);
        setResolvedFileName(targetFile);

        const txtFile = targetFile.replace(/\.pdf$/i, '.txt');
        const txtRes = await fetch(`/api/library/file/${encodeURIComponent(targetDisc)}/txt/${encodeURIComponent(txtFile)}`);
        if (!txtRes.ok) {
          throw new Error(`No se encontró el texto extraído para "${targetFile}"`);
        }
        const rawText = await txtRes.text();
        if (cancelled) return;

        // Parse pages by `## PÁGINA N` markers if present, otherwise keep sections
        const splitByPage = rawText.split(/(?=^##\s+P[ÁA]GINA\s+\d+)/im).filter(s => s.trim().length > 0);
        const parsed: ParsedPage[] = [];
        splitByPage.forEach((sec) => {
          const m = sec.match(/^##\s+P[ÁA]GINA\s+(\d+)/im);
          if (m) {
            parsed.push({ pageNumber: parseInt(m[1], 10), content: sec });
          } else if (parsed.length === 0) {
            parsed.push({ pageNumber: 1, content: sec });
          } else {
            parsed[0].content = `${parsed[0].content}\n\n${sec}`;
          }
        });

        setPagesContent(parsed.length > 0 ? parsed : [{ pageNumber: 1, content: rawText }]);
        setIsLoading(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadError(err?.message || 'Error cargando contenido del documento.');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, documentName]);

  if (!isOpen) return null;

  const totalPages = Math.max(1, pagesContent.length);
  const currentEntry = pagesContent.find(p => p.pageNumber === page) || pagesContent[Math.min(page - 1, pagesContent.length - 1)] || null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/25 backdrop-blur-[6px] transition-all duration-300 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-5xl h-[88vh] rounded-[28px] flex flex-col overflow-hidden border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.18)] select-none transition-all duration-200"
        style={{
          backgroundColor: 'rgba(15, 15, 15, 0.40)',
          backdropFilter: 'blur(24px) saturate(150%)',
          WebkitBackdropFilter: 'blur(24px) saturate(150%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-white shrink-0">
              <FileText className="w-4 h-4 text-neutral-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md font-mono">
                {resolvedFileName}
              </h3>
              <p className="text-[10px] text-neutral-400 font-mono truncate">
                Documento Local ({discipline}) • Vista de Página Extraída
              </p>
            </div>
          </div>

          {/* Controls: Page navigation, Download and Zoom */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-neutral-300">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="hover:text-white disabled:opacity-30 cursor-pointer"
                disabled={page <= 1}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-1 text-[11px]">
                Pág. {page} / {totalPages}
              </span>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="hover:text-white disabled:opacity-30 cursor-pointer"
                disabled={page >= totalPages}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-neutral-300">
              <button 
                onClick={() => setZoom(z => Math.max(70, z - 10))}
                className="hover:text-white cursor-pointer"
                title="Reducir zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] px-1">{zoom}%</span>
              <button 
                onClick={() => setZoom(z => Math.min(150, z + 10))}
                className="hover:text-white cursor-pointer"
                title="Aumentar zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <a
              href={`/api/library/file/${encodeURIComponent(discipline)}/pdf/${encodeURIComponent(resolvedFileName)}`}
              download={resolvedFileName}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-[11px] font-mono text-neutral-200 hover:text-white transition-colors"
              title="Descargar PDF original"
            >
              <Download className="w-3 h-3" />
              <span>PDF</span>
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Document Content Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center bg-black/60 select-text">
          <div 
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
            className="w-full max-w-3xl bg-neutral-900 border border-white/15 rounded-xl shadow-2xl p-6 sm:p-10 text-neutral-200 transition-transform duration-200 min-h-[600px] flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-6 text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                <span>BIBLIOTECA LOCAL ALPHA RAG • /libreria/{discipline}</span>
                <span>PÁGINA {page} DE {totalPages}</span>
              </div>

              {isLoading ? (
                <div className="py-16 flex items-center justify-center gap-2 text-xs font-mono text-neutral-400">
                  <Cpu className="w-4 h-4 animate-spin" />
                  <span>Cargando contenido real del documento...</span>
                </div>
              ) : loadError ? (
                <div className="p-4 rounded-xl bg-red-950/50 border border-red-500/30 text-xs text-red-200">
                  {loadError}
                </div>
              ) : currentEntry ? (
                <MarkdownRenderer content={currentEntry.content} />
              ) : (
                <div className="text-xs text-neutral-400 font-mono">
                  Sin contenido disponible para esta página.
                </div>
              )}
            </div>

            {/* Sheet Footer */}
            <div className="pt-8 mt-8 border-t border-white/10 flex justify-between items-center text-[10px] font-mono text-neutral-500">
              <span>{resolvedFileName}</span>
              <span>Indexación Física F1</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
