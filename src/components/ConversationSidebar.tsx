import React, { useState, useRef, useEffect } from 'react';
import { 
  PanelLeft, 
  PanelLeftClose, 
  Plus, 
  Search, 
  MessageSquare, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  BookOpen, 
  Settings,
  AlertCircle
} from 'lucide-react';
import { ChatSession } from '../types/rag';

interface ConversationSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onClearAllSessions: () => void;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
  documentCount?: number;
  onCardHoverStart?: () => void;
  onCardHoverEnd?: () => void;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  isOpen,
  onToggle,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  onClearAllSessions,
  onOpenLibrary,
  onOpenSettings,
  documentCount = 3,
  onCardHoverStart,
  onCardHoverEnd,
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSessionId]);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleStartRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
    setDeletingSessionId(null);
  };

  const handleSaveRename = (sessionId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitle.trim()) {
      onRenameSession(sessionId, editTitle.trim());
    }
    setEditingSessionId(null);
  };

  const handleCancelRename = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSessionId(null);
  };

  const handlePromptDelete = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingSessionId(sessionId);
    setEditingSessionId(null);
  };

  const handleConfirmDelete = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteSession(sessionId);
    setDeletingSessionId(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingSessionId(null);
  };

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Botón flotante discreto para colapsar/abrir (z-30 al mismo nivel que el área de entrada) */}
      <button
        onClick={onToggle}
        onMouseEnter={onCardHoverStart}
        onMouseLeave={onCardHoverEnd}
        style={{
          backgroundColor: isOpen ? 'rgba(12, 12, 12, 0.25)' : 'rgba(12, 12, 12, 0.20)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
        className={`fixed top-4 z-30 p-2.5 rounded-2xl border text-xs font-mono transition-all duration-300 cursor-pointer shadow-xl flex items-center justify-center ${
          isOpen
            ? 'left-[332px] border-white/20 text-white hover:bg-white/[0.12] hover:border-white/35'
            : 'left-4 border-white/12 text-neutral-400 hover:text-white hover:border-white/25'
        }`}
        title={isOpen ? 'Ocultar panel lateral' : 'Mostrar panel lateral de sesiones'}
      >
        <PanelLeft className="w-4 h-4" />
      </button>

      {/* Backdrop solely on small screens to dismiss on tap (without heavy dark overlay) */}
      <div
        onClick={onToggle}
        className={`fixed inset-0 z-20 bg-black/10 transition-opacity duration-300 sm:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Floating Glassmorphic Panel con 20% de opacidad y z-30 al mismo nivel del input dock */}
      <aside
        onMouseEnter={onCardHoverStart}
        onMouseLeave={onCardHoverEnd}
        style={{
          backgroundColor: 'rgba(10, 10, 10, 0.20)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        }}
        className={`fixed top-4 bottom-4 left-4 z-30 w-[304px] sm:w-[316px] rounded-[28px] glass-sidebar border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.5)] flex flex-col p-3.5 transition-all duration-300 ease-out select-none ${
          isOpen 
            ? 'translate-x-0 opacity-100 pointer-events-auto' 
            : '-translate-x-[360px] opacity-0 pointer-events-none'
        }`}
      >
        {/* Top Header Card (Marca ALPHA + Búsqueda + Nueva Consulta) */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-2.5 flex items-center justify-between shadow-inner">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* White Squircle Logo Badge */}
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-md">
              <svg 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                className="w-5 h-5 text-black"
              >
                {/* Stylized sharp geometric Alpha mark */}
                <path d="M12 2L4 18h4.5l1.8-4.2h3.4L15.5 18H20L12 2zm0 5.8l1.6 3.8h-3.2L12 7.8z" />
              </svg>
            </div>

            <div className="min-w-0">
              <h3 className="text-xs font-bold font-sans tracking-wider text-white uppercase truncate">
                ALPHA
              </h3>
              <p className="text-[11px] font-sans text-neutral-400">
                {sessions.length} {sessions.length === 1 ? 'sesión' : 'sesiones'}
              </p>
            </div>
          </div>

          {/* Action Icons: Search & New Session */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsSearchOpen(prev => !prev)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer ${
                isSearchOpen || searchQuery
                  ? 'bg-white text-black font-semibold'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 hover:text-white'
              }`}
              title="Buscar en conversaciones"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                onCreateSession();
                setSearchQuery('');
                setIsSearchOpen(false);
              }}
              className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] text-white flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-95 shadow-sm"
              title="Crear nueva sesión (+)"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Collapsible Search Input Box */}
        {isSearchOpen && (
          <div className="mt-2.5 px-1 animate-fade-in">
            <div className="relative flex items-center rounded-xl bg-white/[0.04] border border-white/12 px-2.5 py-1.5 text-xs">
              <Search className="w-3 h-3 text-neutral-400 mr-2 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar sesión por nombre..."
                className="w-full bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-neutral-400 hover:text-white ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Subheading: ANTERIORES */}
        <div className="mt-5 mb-2.5 px-2 flex items-center justify-between">
          <span className="text-[11px] font-mono font-semibold tracking-wider uppercase text-neutral-500">
            ANTERIORES
          </span>
          {searchQuery && (
            <span className="text-[10px] font-mono text-neutral-500">
              {filteredSessions.length} resultados
            </span>
          )}
        </div>

        {/* Scrollable Sessions List */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5">
          {filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-xs font-sans text-neutral-500 space-y-2 px-3">
              <MessageSquare className="w-5 h-5 mx-auto opacity-30" />
              <p>
                {searchQuery 
                  ? 'No se encontraron conversaciones con esa búsqueda.' 
                  : 'No hay sesiones registradas.'}
              </p>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isEditing = editingSessionId === session.id;
              const isDeleting = deletingSessionId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    if (!isEditing && !isDeleting) {
                      onSelectSession(session.id);
                    }
                  }}
                  className={`group relative rounded-2xl p-3 border transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white/[0.08] border-white/25 shadow-lg text-white'
                      : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.06] hover:border-white/15 text-neutral-200'
                  }`}
                >
                  {isEditing ? (
                    /* Inline Rename Form */
                    <form
                      onSubmit={(e) => handleSaveRename(session.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') handleCancelRename();
                        }}
                        className="flex-1 bg-black/80 border border-white/30 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white font-sans"
                        placeholder="Nombre de la consulta..."
                      />
                      <button
                        type="submit"
                        className="p-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 transition-colors cursor-pointer"
                        title="Guardar nombre"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelRename}
                        className="p-1.5 rounded-lg hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title="Cancelar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </form>
                  ) : isDeleting ? (
                    /* Delete Confirmation Prompt */
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-between gap-2 text-xs font-mono py-0.5"
                    >
                      <span className="text-[11px] text-neutral-300 truncate">
                        ¿Eliminar?
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleConfirmDelete(session.id, e)}
                          className="px-2 py-1 rounded-lg bg-white text-black text-[10px] font-bold hover:bg-neutral-200 cursor-pointer"
                          title="Confirmar eliminación"
                        >
                          Sí, borrar
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelDelete}
                          className="px-2 py-1 rounded-lg hover:bg-white/[0.1] text-neutral-400 hover:text-white text-[10px] cursor-pointer"
                          title="Cancelar"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Session Card Standard View (exact match to screenshot) */
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Rounded chat bubble outline icon */}
                        <div className="text-neutral-300 shrink-0">
                          <MessageSquare className="w-4 h-4 stroke-[1.8]" />
                        </div>

                        {/* Title */}
                        <span className="text-xs sm:text-sm font-semibold text-white truncate font-sans">
                          {session.title || 'Nueva Consulta'}
                        </span>
                      </div>

                      {/* Action buttons (Rename & Delete) on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(session, e)}
                          className="p-1.5 rounded-lg hover:bg-white/[0.12] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                          title="Renombrar conversación"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handlePromptDelete(session.id, e)}
                          className="p-1.5 rounded-lg hover:bg-white/[0.12] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                          title="Eliminar conversación"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Text link: Borrar todas las sesiones */}
          {sessions.length > 0 && !searchQuery && (
            <div className="pt-2 pb-1 text-center">
              {showClearConfirm ? (
                <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-xs font-sans space-y-1.5">
                  <p className="text-[11px] text-neutral-300 flex items-center justify-center gap-1">
                    <AlertCircle className="w-3 h-3 text-neutral-400" />
                    ¿Borrar todas las sesiones?
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-0.5">
                    <button
                      onClick={() => {
                        onClearAllSessions();
                        setShowClearConfirm(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white text-black text-[10px] font-bold hover:bg-neutral-200 cursor-pointer"
                    >
                      Sí, borrar todas
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="px-2 py-1 rounded-lg hover:bg-white/[0.1] text-neutral-400 text-[10px] cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-xs font-sans text-neutral-500 hover:text-neutral-300 transition-colors py-1 cursor-pointer"
                >
                  Borrar todas las sesiones
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom Footer Action Pills: [ Libreria (X) ] [ Ajustes ] */}
        <div className="pt-3 border-t border-white/[0.08] flex items-center gap-2">
          {/* Libreria Button */}
          <button
            type="button"
            onClick={onOpenLibrary}
            className="flex-1 py-2.5 px-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/18 text-xs font-medium text-neutral-200 hover:text-white flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer shadow-sm active:scale-[0.98]"
            title="Ver Documentos PDF y Librería"
          >
            <BookOpen className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
            <span className="font-sans font-medium text-xs">Libreria ({documentCount})</span>
          </button>

          {/* Ajustes Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="py-2.5 px-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/18 text-xs font-medium text-neutral-200 hover:text-white flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer shadow-sm active:scale-[0.98]"
            title="Ajustes y Parámetros del Motor"
          >
            <Settings className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
            <span className="font-sans font-medium text-xs">Ajustes</span>
          </button>
        </div>
      </aside>
    </>
  );
};
