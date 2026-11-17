import React, { useState } from 'react';
import { 
  Database, 
  Search, 
  Sliders, 
  Layers, 
  Eye, 
  Sparkles, 
  ArrowUpRight, 
  Share2, 
  Activity, 
  Hash, 
  Compass,
  FileText
} from 'lucide-react';
import { ChunkItem } from '../types/rag';
import { SAMPLE_CHUNKS, SAMPLE_DOCUMENTS } from '../data/mockRagData';
import { MarkdownRenderer } from './MarkdownRenderer';

interface VectorVisualizerProps {
  onSelectChunk: (chunk: ChunkItem) => void;
  onOpenPdf: (docName: string, page: number) => void;
  onCardHoverStart: () => void;
  onCardHoverEnd: () => void;
}

export const VectorVisualizer: React.FC<VectorVisualizerProps> = ({
  onSelectChunk,
  onOpenPdf,
  onCardHoverStart,
  onCardHoverEnd,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.80);
  const [activeChunk, setActiveChunk] = useState<ChunkItem>(SAMPLE_CHUNKS[0]);
  const [searchFilter, setSearchFilter] = useState('');

  const filteredChunks = SAMPLE_CHUNKS.filter((chunk) => {
    const matchesCategory = selectedCategory === 'all' || chunk.category === selectedCategory;
    const matchesSim = chunk.similarity >= similarityThreshold;
    const matchesSearch = 
      chunk.text.toLowerCase().includes(searchFilter.toLowerCase()) ||
      chunk.sectionTitle.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCategory && matchesSim && matchesSearch;
  });

  const categories = ['all', 'Arquitectura', 'Legal & SLA', 'Investigación AI'];

  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
      
      {/* Header Info Banner */}
      <div 
        className="glass-panel rounded-2xl p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 glass-panel-hover"
        onMouseEnter={onCardHoverStart}
        onMouseLeave={onCardHoverEnd}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white">
            <Database className="w-5 h-5 text-neutral-300" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-wide text-white font-mono uppercase">
              Espacio Latente de Embeddings Vectoriales (Proyección t-SNE)
            </h2>
            <p className="text-xs text-neutral-400">
              Explora los 404 vectores proyectados en 2D según afinidad semántica y distancias de coseno.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-neutral-300">
          <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10">
            Dimensión: <span className="text-white">768-D Float32</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10">
            Index: <span className="text-white">HNSW (M=16, ef=64)</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10">
            Métrica: <span className="text-white">Cosine Distance</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Category Filters & Threshold */}
      <div 
        className="glass-panel rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4"
        onMouseEnter={onCardHoverStart}
        onMouseLeave={onCardHoverEnd}
      >
        {/* Category selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-[11px] font-mono text-neutral-500 uppercase mr-1">Clúster:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-white text-black font-semibold'
                  : 'bg-white/[0.03] text-neutral-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]'
              }`}
            >
              {cat === 'all' ? 'Todos los Clústeres' : cat}
            </button>
          ))}
        </div>

        {/* Similarity Threshold Slider */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-neutral-400">Umbral Similitud:</span>
            <input
              type="range"
              min="0.70"
              max="0.99"
              step="0.01"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
              className="w-28 accent-white cursor-pointer"
            />
            <span className="text-xs font-mono text-white min-w-[42px]">
              {(similarityThreshold * 100).toFixed(0)}%
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Buscar en chunks..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="glass-input rounded-xl px-3 py-1 text-xs pl-7 w-40 sm:w-52"
            />
            <Search className="w-3 h-3 text-neutral-500 absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Visualizer & Detail Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 2D Vector Canvas Representation */}
        <div 
          className="lg:col-span-7 glass-panel rounded-2xl p-5 flex flex-col justify-between min-h-[440px] relative overflow-hidden"
          onMouseEnter={onCardHoverStart}
          onMouseLeave={onCardHoverEnd}
        >
          {/* Coordinate system background grid */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.03)_0%,_transparent_70%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          
          <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 z-10 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Plano Semántico 2D (t-SNE / PCA Projection)</span>
            </div>
            <span>Vectores visibles: {filteredChunks.length}</span>
          </div>

          {/* Interactive Scatter Canvas Elements */}
          <div className="relative w-full h-[360px] border border-white/[0.08] rounded-xl bg-black/40 overflow-hidden">
            {/* Center crosshair */}
            <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/[0.06] -translate-x-1/2 pointer-events-none" />
            <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/[0.06] -translate-y-1/2 pointer-events-none" />
            
            {/* Query vector centroid marker */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none z-20">
              <div className="w-6 h-6 rounded-full border border-white/60 animate-ping opacity-30" />
              <div className="w-2.5 h-2.5 bg-white rounded-full absolute top-1.5" />
              <span className="text-[9px] font-mono text-white/80 bg-black/80 px-1 rounded mt-4 border border-white/20 whitespace-nowrap">
                Vector Consulta
              </span>
            </div>

            {/* Chunk Nodes */}
            {filteredChunks.map((chunk) => {
              const isSelected = activeChunk.id === chunk.id;
              return (
                <button
                  key={chunk.id}
                  onClick={() => {
                    setActiveChunk(chunk);
                    onSelectChunk(chunk);
                  }}
                  style={{
                    left: `${chunk.coordinates.x}%`,
                    top: `${chunk.coordinates.y}%`,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all duration-300 group z-10 cursor-pointer ${
                    isSelected
                      ? 'scale-150 z-30 ring-4 ring-white/20'
                      : 'hover:scale-125 hover:z-20'
                  }`}
                  title={`${chunk.documentName} • Pág. ${chunk.pageNumber} (${(chunk.similarity * 100).toFixed(1)}%)`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-white border-white shadow-[0_0_15px_rgba(255,255,255,0.8)]'
                        : chunk.similarity > 0.92
                        ? 'bg-neutral-200 border-white/80 shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                        : 'bg-neutral-600 border-white/30'
                    }`}
                  />
                  
                  {/* Tooltip on node */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded bg-black/90 border border-white/20 text-[10px] font-mono text-white whitespace-nowrap pointer-events-none z-30 shadow-2xl">
                    Pág. {chunk.pageNumber} • {(chunk.similarity * 100).toFixed(1)}% Sim
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 pt-3 z-10">
            <span>Haz clic en un nodo para cargar el vector y fragmento correspondiente</span>
            <span>Distancia euclídea normalizada</span>
          </div>
        </div>

        {/* Selected Chunk Inspector Card */}
        <div 
          className="lg:col-span-5 glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4"
          onMouseEnter={onCardHoverStart}
          onMouseLeave={onCardHoverEnd}
        >
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-neutral-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-300">
                  Chunk Inspector #{activeChunk.chunkIndex}
                </span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/[0.08] text-white border border-white/10">
                Sim: {(activeChunk.similarity * 100).toFixed(1)}%
              </span>
            </div>

            {/* Document metadata */}
            <div className="space-y-2 mb-4">
              <div className="text-[11px] font-mono text-neutral-400">DOCUMENTO ORIGEN:</div>
              <div className="text-xs text-white font-medium flex items-center gap-1.5 bg-white/[0.03] p-2 rounded-xl border border-white/[0.06]">
                <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span className="truncate">{activeChunk.documentName}</span>
              </div>
            </div>

            {/* Section Title */}
            <div className="space-y-1 mb-3">
              <div className="text-[11px] font-mono text-neutral-400">SECCIÓN / ENCABEZADO:</div>
              <div className="text-xs font-semibold text-neutral-200">
                {activeChunk.sectionTitle}
              </div>
            </div>

            {/* Chunk Content Excerpt */}
            <div className="space-y-1 mb-4">
              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                <span>TEXTO DEL FRAGMENTO:</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-white/[0.08] text-neutral-300">.md</span>
              </div>
              <div className="p-3 rounded-xl bg-black/60 border border-white/10 text-xs text-neutral-300 leading-relaxed max-h-44 overflow-y-auto font-sans selection:bg-white selection:text-black">
                <MarkdownRenderer content={activeChunk.text} />
              </div>
            </div>

            {/* Vector Tensor Snapshot */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                <span>VECTOR EMBEDDING SNAPSHOT (8/768 DIMS):</span>
                <span>Float32</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] font-mono text-[11px] text-neutral-400 grid grid-cols-4 gap-1.5 text-center">
                {activeChunk.vectorPreview.map((val, idx) => (
                  <div key={idx} className="bg-black/40 py-1 rounded border border-white/5 text-neutral-300">
                    {val > 0 ? `+${val.toFixed(4)}` : val.toFixed(4)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between gap-3">
            <button
              onClick={() => onOpenPdf(activeChunk.documentName, activeChunk.pageNumber)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white text-black text-xs font-medium hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              <span>Abrir en Visor PDF</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onSelectChunk(activeChunk)}
              className="py-2 px-3 rounded-xl bg-white/[0.04] border border-white/10 text-neutral-300 hover:text-white hover:bg-white/[0.08] text-xs font-mono transition-colors cursor-pointer"
            >
              Detalle Completo
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
