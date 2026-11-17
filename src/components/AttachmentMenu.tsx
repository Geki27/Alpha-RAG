import React, { useState, useRef } from 'react';
import { 
  Paperclip, 
  X, 
  FileText, 
  Folder, 
  Image as ImageIcon, 
  Clipboard, 
  Link as LinkIcon, 
  MessageSquare, 
  AtSign,
  Check,
  Globe,
  HardDrive,
  Layers,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export interface AttachedResource {
  id: string;
  type: 'file' | 'folder' | 'image' | 'url';
  name: string;
  size?: string;
  fileCount?: number;
  previewUrl?: string;
  rawFile?: File;
}

export type SearchScope = 'local' | 'web' | 'ambas';

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onAttachResource: (resource: AttachedResource) => void;
  onSelectPromptSnippet: (snippet: string) => void;
  searchScope: SearchScope;
  setSearchScope: (scope: SearchScope) => void;
}

const MECHANICAL_PROMPT_SNIPPETS = [
  {
    title: 'Criterio de Fatiga de Goodman',
    category: 'Diseño Mecánico',
    snippet: 'Explica el criterio de falla por fatiga de Goodman modificado para esfuerzos fluctuantes alternantes $\\sigma_a$ y medios $\\sigma_m$, y cómo influyen los factores de corrección de Marin $k_a, k_b, k_c$.'
  },
  {
    title: 'Círculo de Mohr & Esfuerzos Principales',
    category: 'Mecánica de Materiales',
    snippet: 'Detalla el procedimiento matemático para trazar el círculo de Mohr a partir de $(\\sigma_x, \\sigma_y, \\tau_{xy})$, calculando el radio $R$, el centro y los esfuerzos principales $\\sigma_1, \\sigma_2$.'
  },
  {
    title: 'Ecuaciones de Equilibrio Coplanar',
    category: 'Estática',
    snippet: 'Formula las condiciones de equilibrio estático para un cuerpo rígido coplanar ($\\sum F_x = 0, \\sum F_y = 0, \\sum M_O = 0$) y describe la metodología para dibujar su diagrama de cuerpo libre (DCL).'
  },
  {
    title: 'Primera Ley de la Termodinámica',
    category: 'Termodinámica',
    snippet: 'Formula el balance de energía para un sistema cerrado estacionario $Q_{\\text{neto}} - W_{\\text{neto}} = \\Delta U$, especificando el cálculo de trabajo de frontera móvil $W_b = \\int P dV$.'
  },
  {
    title: 'Ecuación de Flexión de Lewis (AGMA)',
    category: 'Elementos de Máquinas',
    snippet: 'Deriva la ecuación de flexión de Lewis para engranajes rectos: $\\sigma = \\frac{W_t}{F \\cdot m} \\cdot K_v \\cdot \\frac{1}{J}$, explicando el significado físico de cada factor de servicio y geometría.'
  },
  {
    title: 'Energía de Distorsión (Von Mises)',
    category: 'Resistencia de Materiales',
    snippet: '¿Cómo se define el esfuerzo equivalente de Von Mises $\\sigma_v = \\sqrt{\\sigma_1^2 - \\sigma_1 \\sigma_2 + \\sigma_2^2}$ para materiales dúctiles y cuándo predice la fluencia con respecto a $S_y$?'
  }
];

export const AttachmentMenu: React.FC<AttachmentMenuProps> = ({
  isOpen,
  onClose,
  onAttachResource,
  onSelectPromptSnippet,
  searchScope,
  setSearchScope,
}) => {
  const [activeSubView, setActiveSubView] = useState<'main' | 'url' | 'snippets'>('main');
  const [urlInput, setUrlInput] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [clipboardFeedback, setClipboardFeedback] = useState<string | null>(null);

  // Hidden native file input refs
  const filesInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const imagesInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // 1. Files Handler
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
        onAttachResource({
          id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          type: 'file',
          name: file.name,
          size: sizeMB,
          rawFile: file
        });
      });
      onClose();
    }
  };

  // 2. Folder Handler
  const handleFolderSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const folderName = files[0].webkitRelativePath?.split('/')[0] || 'Carpeta de Documentos';
      const totalSizeMB = (files.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(1) + ' MB';
      
      onAttachResource({
        id: `folder-${Date.now()}`,
        type: 'folder',
        name: folderName,
        fileCount: files.length,
        size: totalSizeMB
      });
      onClose();
    }
  };

  // 3. Images Handler
  const handleImagesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        const previewUrl = URL.createObjectURL(file);
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
        onAttachResource({
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          type: 'image',
          name: file.name,
          size: sizeMB,
          previewUrl,
          rawFile: file
        });
      });
      onClose();
    }
  };

  // 4. Paste Image from Clipboard
  const handlePasteImageFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.read) {
        setClipboardFeedback('Tu navegador requiere permisos directos para el portapapeles. Puedes usar Ctrl+V.');
        setTimeout(() => setClipboardFeedback(null), 3000);
        return;
      }

      const clipboardItems = await navigator.clipboard.read();
      let foundImage = false;

      for (const item of clipboardItems) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const previewUrl = URL.createObjectURL(blob);
          const ext = imageType.split('/')[1] || 'png';
          onAttachResource({
            id: `pasted-img-${Date.now()}`,
            type: 'image',
            name: `Captura_Portapapeles_${new Date().toLocaleTimeString().replace(/:/g, '-')}.${ext}`,
            size: (blob.size / 1024).toFixed(0) + ' KB',
            previewUrl
          });
          foundImage = true;
          onClose();
          break;
        }
      }

      if (!foundImage) {
        setClipboardFeedback('No se detectó ninguna imagen en el portapapeles.');
        setTimeout(() => setClipboardFeedback(null), 2500);
      }
    } catch (err) {
      setClipboardFeedback('Acceso al portapapeles denegado o no disponible. Puedes usar Ctrl+V.');
      setTimeout(() => setClipboardFeedback(null), 3000);
    }
  };

  // 5. Submit URL Resource
  const handleSubmitUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    let validUrl = urlInput.trim();
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = 'https://' + validUrl;
    }

    const hostName = new URL(validUrl).hostname;
    const name = urlTitle.trim() || hostName;

    onAttachResource({
      id: `url-${Date.now()}`,
      type: 'url',
      name,
      previewUrl: validUrl
    });

    setUrlInput('');
    setUrlTitle('');
    setActiveSubView('main');
    onClose();
  };

  return (
    <>
      {/* Hidden Native File Pickers */}
      <input 
        ref={filesInputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md,.docx,.doc,.py,.ts,.js,.json,.csv"
        className="hidden"
        onChange={handleFilesSelected}
      />
      <input 
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFolderSelected}
      />
      <input 
        ref={imagesInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleImagesSelected}
      />

      {/* Outgoing Popover Menu Window - Matching exact Library glassmorphism (rgba(15, 15, 15, 0.40) + blur(24px) saturate(150%)) and sleek compact scale */}
      <div 
        className="absolute bottom-full mb-2.5 left-0 w-72 sm:w-[310px] rounded-[22px] border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.18)] overflow-hidden transition-all duration-200 z-50 select-none animate-in fade-in zoom-in-95"
        style={{
          backgroundColor: 'rgba(15, 15, 15, 0.40)',
          backdropFilter: 'blur(24px) saturate(150%)',
          WebkitBackdropFilter: 'blur(24px) saturate(150%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* SUBVIEW: URL INPUT */}
        {activeSubView === 'url' ? (
          <div className="p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
              <button
                type="button"
                onClick={() => setActiveSubView('main')}
                className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver</span>
              </button>
              <h3 className="text-xs font-bold font-sans uppercase tracking-wider text-white">
                Adjuntar Enlace Web
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="w-6 h-6 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmitUrl} className="space-y-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-neutral-300">URL del recurso web:</label>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://ejemplo.org/articulo-tecnico"
                  autoFocus
                  className="w-full px-2.5 py-1.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/40 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-neutral-300">Etiqueta opcional:</label>
                <input
                  type="text"
                  value={urlTitle}
                  onChange={(e) => setUrlTitle(e.target.value)}
                  placeholder="Ej: Norma AGMA 2001-D04"
                  className="w-full px-2.5 py-1.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/40 font-sans"
                />
              </div>

              <div className="pt-1 flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveSubView('main')}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/10 text-xs text-neutral-300 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!urlInput.trim()}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    urlInput.trim()
                      ? 'bg-white text-black hover:bg-neutral-200 cursor-pointer shadow-sm'
                      : 'bg-white/10 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  Adjuntar URL
                </button>
              </div>
            </form>
          </div>
        ) : activeSubView === 'snippets' ? (
          /* SUBVIEW: PROMPT SNIPPETS */
          <div className="p-3.5 space-y-2.5 max-h-[420px] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveSubView('main')}
                className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver</span>
              </button>
              <h3 className="text-xs font-bold font-sans uppercase tracking-wider text-white">
                Plantillas Rápidas
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="w-6 h-6 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[10px] text-neutral-400 shrink-0">
              Selecciona una plantilla para insertarla directamente:
            </p>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
              {MECHANICAL_PROMPT_SNIPPETS.map((snip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onSelectPromptSnippet(snip.snippet);
                    onClose();
                  }}
                  className="w-full text-left p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white group-hover:text-amber-200 transition-colors text-[11px]">
                      {snip.title}
                    </span>
                    <span className="text-[9px] font-mono text-neutral-400 px-1 py-0.5 rounded bg-white/[0.04]">
                      {snip.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 line-clamp-2 mt-0.5 leading-relaxed">
                    {snip.snippet}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* MAIN MENU: MATCHING SCREENSHOT WITH COMPACT PROPORTIONS AND LIBRARY GLASSMORPHISM */
          <div className="p-3 sm:p-3.5 space-y-2.5">
            {/* Top Header Row */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/12 flex items-center justify-center text-white shrink-0 shadow-inner">
                  <Paperclip className="w-3.5 h-3.5 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold font-sans tracking-wide text-white uppercase">
                    ADJUNTAR
                  </h3>
                  <p className="text-[10px] text-neutral-400 font-sans">
                    Archivos y recursos
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-6 h-6 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Cerrar menú"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Clipboard feedback alert if triggered */}
            {clipboardFeedback && (
              <div className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[11px] font-sans animate-fade-in">
                {clipboardFeedback}
              </div>
            )}

            {/* List of 6 Attachment Actions */}
            <div className="space-y-0.5">
              {/* 1. Files... */}
              <button
                type="button"
                onClick={() => filesInputRef.current?.click()}
                className="w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group text-left"
              >
                <div className="w-7.5 h-7.5 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-neutral-300 group-hover:text-white group-hover:border-white/20 transition-all shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white group-hover:text-neutral-100 font-sans">
                    Files...
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate font-sans">
                    PDF, TXT, MD, DOCX, código
                  </div>
                </div>
              </button>

              {/* 2. Folder... */}
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group text-left"
              >
                <div className="w-7.5 h-7.5 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-neutral-300 group-hover:text-white group-hover:border-white/20 transition-all shrink-0">
                  <Folder className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white group-hover:text-neutral-100 font-sans">
                    Folder...
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate font-sans">
                    Carpeta completa
                  </div>
                </div>
              </button>

              {/* 3. Images... */}
              <button
                type="button"
                onClick={() => imagesInputRef.current?.click()}
                className="w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group text-left"
              >
                <div className="w-7.5 h-7.5 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-neutral-300 group-hover:text-white group-hover:border-white/20 transition-all shrink-0">
                  <ImageIcon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white group-hover:text-neutral-100 font-sans">
                    Images...
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate font-sans">
                    Imágenes y capturas
                  </div>
                </div>
              </button>

              {/* 4. Paste image */}
              <button
                type="button"
                onClick={handlePasteImageFromClipboard}
                className="w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group text-left"
              >
                <div className="w-7.5 h-7.5 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-neutral-300 group-hover:text-white group-hover:border-white/20 transition-all shrink-0">
                  <Clipboard className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white group-hover:text-neutral-100 font-sans">
                    Paste image
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate font-sans">
                    Desde el portapapeles
                  </div>
                </div>
              </button>

              {/* 5. URL... */}
              <button
                type="button"
                onClick={() => setActiveSubView('url')}
                className="w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group text-left"
              >
                <div className="w-7.5 h-7.5 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-neutral-300 group-hover:text-white group-hover:border-white/20 transition-all shrink-0">
                  <LinkIcon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white group-hover:text-neutral-100 font-sans">
                    URL...
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate font-sans">
                    Web o enlace externo
                  </div>
                </div>
              </button>

              {/* 6. Prompt snippets... */}
              <button
                type="button"
                onClick={() => setActiveSubView('snippets')}
                className="w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group text-left"
              >
                <div className="w-7.5 h-7.5 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-neutral-300 group-hover:text-white group-hover:border-white/20 transition-all shrink-0">
                  <MessageSquare className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white group-hover:text-neutral-100 font-sans">
                    Prompt snippets...
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate font-sans">
                    Plantillas rápidas
                  </div>
                </div>
              </button>
            </div>

            {/* Section: ALCANCE DE BÚSQUEDA */}
            <div className="space-y-1.5 pt-1.5 border-t border-white/[0.08]">
              <div className="text-[9px] font-mono tracking-widest text-neutral-400 uppercase px-1">
                ALCANCE DE BÚSQUEDA
              </div>

              {/* Segmented control */}
              <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-black/40 border border-white/10">
                {(['local', 'web', 'ambas'] as SearchScope[]).map((scope) => {
                  const isSelected = searchScope === scope;
                  const label = scope === 'local' ? 'Local' : scope === 'web' ? 'Web' : 'Ambas';
                  return (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setSearchScope(scope)}
                      className={`py-1 rounded-lg text-[11px] font-sans transition-all duration-150 cursor-pointer text-center ${
                        isSelected
                          ? 'bg-neutral-800 text-white font-medium border border-white/20 shadow-xs'
                          : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Tip with @ icon */}
            <div className="pt-1.5 border-t border-white/[0.06] flex items-center gap-1.5 text-[10px] text-neutral-400 font-sans px-0.5">
              <span className="w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center text-[9px] font-mono text-neutral-300 shrink-0">
                @
              </span>
              <span>
                Tip: escribe <code className="text-neutral-200 font-mono">@</code> para referenciar documentos
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
