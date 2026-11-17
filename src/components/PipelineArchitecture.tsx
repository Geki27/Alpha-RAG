import React, { useState } from 'react';
import { 
  Cpu, 
  Layers, 
  Database, 
  ArrowRight, 
  FileText, 
  Sparkles, 
  Binary, 
  Filter, 
  Bot, 
  CheckCircle2, 
  Activity,
  Terminal,
  ChevronRight
} from 'lucide-react';

interface PipelineArchitectureProps {
  onCardHoverStart: () => void;
  onCardHoverEnd: () => void;
}

interface PipelineStep {
  id: string;
  number: string;
  title: string;
  component: string;
  description: string;
  specs: { [key: string]: string };
  latency: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: 'ingestion',
    number: '01',
    title: 'Extracción & Parseo PDF',
    component: 'PDF Parser + OCR Engine',
    description: 'Extracción jerárquica de texto, fuentes, tablas y coordenadas espaciales por página en documentos PDF.',
    specs: {
      'Motor': 'PdfPig / PyMuPDF',
      'Resolución OCR': '300 DPI',
      'Extracción Tablas': 'Estructurada en Markdown',
      'Metadatos': 'Autor, Páginas, Timestamps',
    },
    latency: '~120ms / pág',
  },
  {
    id: 'chunking',
    number: '02',
    title: 'Chunking Semántico Adaptativo',
    component: 'Recursive Semantic Splitter',
    description: 'División del texto respetando encabezados jerárquicos y párrafos continuos para evitar fragmentar oraciones clave.',
    specs: {
      'Tamaño de Chunk': '512 Tokens',
      'Solapamiento (Overlap)': '64 Tokens',
      'Separadores': '["\\n## ", "\\n\\n", "\\n", ". "]',
      'Preservación': 'Encabezados padre como contexto',
    },
    latency: '8ms',
  },
  {
    id: 'embedding',
    number: '03',
    title: 'Vectorización con Embeddings',
    component: 'text-embedding-004',
    description: 'Conversión de fragmentos textuales en tensores densos normalizados de 768 dimensiones en coma flotante.',
    specs: {
      'Dimensiones': '768 Float32',
      'Normalización': 'L2 Unit Vector',
      'Batch Size': '32 chunks/batch',
      'Vocabulario': 'Multilingüe (ES, EN, DE, FR)',
    },
    latency: '45ms',
  },
  {
    id: 'vectordb',
    number: '04',
    title: 'Indexación en Base Vectorial',
    component: 'HNSW Graph Index (Cosine)',
    description: 'Almacenamiento en grafo jerárquico HNSW para búsqueda aproximada de vecinos más cercanos (ANN) a escala.',
    specs: {
      'Métrica Distancia': 'Cosine Similarity',
      'Parámetros': 'M = 16, efConstruction = 64',
      'Cuantización': 'PQ8 (Product Quantization)',
      'Escalabilidad': 'Sub-milisegundo en millones de vectores',
    },
    latency: '< 4ms',
  },
  {
    id: 'retrieval',
    number: '05',
    title: 'Recuperación Multi-Alcance (Local, Web, Combinadas)',
    component: 'Physical Library + Web Standards (ASME, AGMA, ISO, AWS, TEMA) + Search Grounding',
    description: 'Búsqueda flexible en libros físicos de texto (/libreria/), normas técnicas industriales y catálogos en línea (ASME BPVC, AGMA, ISO 286/898/20816, MatWeb, SKF, AWS D1.1, TEMA), además de Google Search Grounding para información en tiempo real con fusión RRF.',
    specs: {
      'Alcances Soportados': 'Local (/libreria/), Web (Normas/Grounding), Ambas (Híbrida RRF)',
      'Estándares Web': 'ASME BPVC VIII/B31.3, AGMA 2001, ISO 286/898, MatWeb, SKF, AWS D1.1, TEMA',
      'Algoritmo de Fusión': 'Reciprocal Rank Fusion (RRF) + Google Search Grounding',
      'Filtrado y Scraping': 'Scraper técnico en vivo con saneamiento DOM y timeout estricto',
    },
    latency: '18ms',
  },
  {
    id: 'synthesis',
    number: '06',
    title: 'Síntesis Neural con Google AI & NVIDIA NIM',
    component: 'Gemini 3.8 Flash / Argon + NVIDIA NIM (Llama 3.3 / DeepSeek R1)',
    description: 'Inyección de contexto verificado en el prompt con instrucciones estrictas de citación de página, normas y derivación matemática en LaTeX con control de esfuerzo y thinking.',
    specs: {
      'Proveedores': 'Google AI Studio (@google/genai) & NVIDIA NIM Microservices',
      'Modelos': 'Gemini 3.8 Flash, Gemini 4, Llama 3.3 70B, DeepSeek R1',
      'Control de Razonamiento': 'Thinking ON/OFF + Esfuerzo (Min, Low, Med, High, Max)',
      'Formato Matemático': 'LaTeX KaTeX ($...$ / $$...$$)',
    },
    latency: '~240ms',
  },
];

export const PipelineArchitecture: React.FC<PipelineArchitectureProps> = ({
  onCardHoverStart,
  onCardHoverEnd,
}) => {
  const [activeStep, setActiveStep] = useState<PipelineStep>(PIPELINE_STEPS[0]);

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
            <Cpu className="w-5 h-5 text-neutral-300" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-wide text-white font-mono uppercase">
              Topología del Pipeline RAG & Flujo de Inferencia
            </h2>
            <p className="text-xs text-neutral-400">
              Arquitectura de extremo a extremo: desde la ingesta de documentos hasta la generación de respuestas fundamentadas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-neutral-300">
          <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10">
            Latencia Total: <span className="text-white">~350 ms p95</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10">
            Recall Semántico: <span className="text-white">96.8%</span>
          </div>
        </div>
      </div>

      {/* Pipeline Diagram (Horizontal / Responsive) */}
      <div 
        className="glass-panel rounded-2xl p-6"
        onMouseEnter={onCardHoverStart}
        onMouseLeave={onCardHoverEnd}
      >
        <div className="text-xs font-mono uppercase text-neutral-400 tracking-wider mb-6">
          Etapas del Flujo de Datos
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          {PIPELINE_STEPS.map((step, idx) => {
            const isSelected = activeStep.id === step.id;
            return (
              <div key={step.id} className="relative flex flex-col">
                <button
                  onClick={() => setActiveStep(step)}
                  className={`text-left p-4 rounded-xl border transition-all duration-200 h-full flex flex-col justify-between ${
                    isSelected
                      ? 'bg-white text-black border-white shadow-xl shadow-white/10 scale-102 z-10'
                      : 'bg-white/[0.02] border-white/[0.08] text-neutral-300 hover:border-white/30 hover:bg-white/[0.05]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-black text-white' : 'bg-white/[0.06] text-neutral-400'
                      }`}>
                        PASO {step.number}
                      </span>
                      <span className={`text-[10px] font-mono ${isSelected ? 'text-neutral-700' : 'text-neutral-500'}`}>
                        {step.latency}
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold leading-tight mb-1">
                      {step.title}
                    </h4>
                    <p className={`text-[11px] font-mono leading-tight ${isSelected ? 'text-neutral-800' : 'text-neutral-400'}`}>
                      {step.component}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-current/10 flex items-center justify-between text-[10px] font-mono">
                    <span>{isSelected ? 'Seleccionado' : 'Ver detalle'}</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Technical Inspector of Selected Step */}
      <div 
        className="glass-panel rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6"
        onMouseEnter={onCardHoverStart}
        onMouseLeave={onCardHoverEnd}
      >
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/[0.08] text-white">
              Paso {activeStep.number}
            </span>
            <h3 className="text-base font-semibold text-white">
              {activeStep.title}
            </h3>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed font-sans">
            {activeStep.description}
          </p>

          <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-neutral-300 space-y-1">
            <div className="text-neutral-500 text-[10px] uppercase">Componente en Tiempo de Ejecución:</div>
            <div className="text-white font-medium flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-neutral-400" />
              {activeStep.component}
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 space-y-3">
          <div className="text-xs font-mono uppercase tracking-wider text-neutral-400">
            Parámetros de Configuración & Especificaciones Técnicas
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(activeStep.specs).map(([key, val]) => (
              <div 
                key={key} 
                className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs font-mono"
              >
                <div className="text-[10px] text-neutral-500 mb-0.5">{key}</div>
                <div className="text-neutral-200 font-medium">{val}</div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs font-mono text-neutral-300">
            <span>Latencia p95 Estimada:</span>
            <span className="text-white font-semibold">{activeStep.latency}</span>
          </div>
        </div>
      </div>

    </div>
  );
};
