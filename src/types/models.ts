export type ModelProvider = 'google' | 'nvidia';

export type EffortLevel = 'minimal' | 'low' | 'medium' | 'high' | 'max';

export type EffortShortLabel = 'Min' | 'Low' | 'Med' | 'High' | 'Max';

export interface ModelDefinition {
  id: string;
  name: string;
  provider: ModelProvider;
  providerLabel: string;
  badge: string;
  shortName: string;
  supportsThinking: boolean;
  supportsVision?: boolean;
  description: string;
  isPaid?: boolean;
}

export const EFFORT_SHORT_LABELS: Record<EffortLevel, EffortShortLabel> = {
  minimal: 'Min',
  low: 'Low',
  medium: 'Med',
  high: 'High',
  max: 'Max',
};

export const AVAILABLE_MODELS: ModelDefinition[] = [
  // Google AI Models (gemini-2.5-flash & gemini-4-hydrogen are active, verified, and multimodal)
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    providerLabel: 'Google AI · gemini-2.5-flash',
    badge: 'Recomendado',
    shortName: 'Gemini 2.5 Flash',
    supportsThinking: true,
    supportsVision: true,
    description: 'Modelo de máxima confiabilidad y velocidad para síntesis RAG e OCR multimodal.',
  },
  {
    id: 'gemini-4-hydrogen',
    name: 'Gemini 4 Hydrogen',
    provider: 'google',
    providerLabel: 'Google AI · gemini-4-hydrogen',
    badge: 'Multimodal',
    shortName: 'Gemini 4 H',
    supportsThinking: true,
    supportsVision: true,
    description: 'Modelo Gemini 4 de alta velocidad para síntesis RAG y OCR de fórmulas LaTeX.',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'google',
    providerLabel: 'Google AI · gemini-2.5-flash-lite',
    badge: 'Ultra Rápido',
    shortName: 'Flash Lite',
    supportsThinking: true,
    supportsVision: true,
    description: 'Latencia mínima para consultas rápidas y OCR ligero de páginas escaneadas.',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    provider: 'google',
    providerLabel: 'Google AI · gemini-3.8-flash',
    badge: 'Preview',
    shortName: 'Gemini 3.8',
    supportsThinking: true,
    supportsVision: true,
    description: 'Modelo experimental (sujeto a picos de demanda del servidor de Google).',
  },
  {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    provider: 'google',
    providerLabel: 'Google AI · gemini-4-argon',
    badge: 'Requiere Pago',
    shortName: 'Gemini 4',
    supportsThinking: true,
    supportsVision: true,
    isPaid: true,
    description: 'Modelo de máxima profundidad STEM (requiere API key con plan de facturación activo).',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    provider: 'google',
    providerLabel: 'Google AI · gemini-3.1-pro-preview',
    badge: 'Requiere Pago',
    shortName: 'Gemini 3.1 Pro',
    supportsThinking: true,
    supportsVision: true,
    isPaid: true,
    description: 'Razonamiento pro para ingeniería (requiere API key con facturación activa).',
  },

  // NVIDIA NIM Vision / OCR Models
  {
    id: 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1',
    name: 'Nemotron Nano VL 8B (OCR)',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM · nvidia/llama-3.1-nemotron-nano-vl-8b-v1',
    badge: 'Vision OCR',
    shortName: 'Nemotron VL',
    supportsThinking: false,
    supportsVision: true,
    description: 'Modelo VLM de NVIDIA optimizado para OCR de documentos técnicos, tablas y ecuaciones.',
  },
  {
    id: 'meta/llama-3.2-90b-vision-instruct',
    name: 'Llama 3.2 90B Vision',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM · meta/llama-3.2-90b-vision-instruct',
    badge: 'Vision Pro',
    shortName: 'Llama 3.2 90B VL',
    supportsThinking: false,
    supportsVision: true,
    description: 'Modelo multimodal de alta precisión para planos, tablas y reconstrucción LaTeX.',
  },
  {
    id: 'meta/llama-3.2-11b-vision-instruct',
    name: 'Llama 3.2 11B Vision',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM · meta/llama-3.2-11b-vision-instruct',
    badge: 'Vision Fast',
    shortName: 'Llama 3.2 11B VL',
    supportsThinking: false,
    supportsVision: true,
    description: 'Modelo multimodal rápido de NVIDIA NIM para OCR de páginas escaneadas.',
  },
  {
    id: 'qwen/qwen2.5-vl-72b-instruct',
    name: 'Qwen 2.5 VL 72B Instruct',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM · qwen/qwen2.5-vl-72b-instruct',
    badge: 'Math OCR',
    shortName: 'Qwen 2.5 VL',
    supportsThinking: false,
    supportsVision: true,
    description: 'VLM especializado en OCR matemático, fórmulas LaTeX y diagramas científicos.',
  },

  // NVIDIA NIM Text / Reasoning Models
  {
    id: 'meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM · meta/llama-3.3-70b-instruct',
    badge: 'Open Weights',
    shortName: 'Llama 3.3',
    supportsThinking: true,
    supportsVision: false,
    description: 'Microservicio NVIDIA NIM acelerado por TensorRT-LLM para síntesis y derivación técnica.',
  },
  {
    id: 'deepseek-ai/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM · deepseek-ai/deepseek-r1',
    badge: 'Deep Reasoning',
    shortName: 'DeepSeek R1',
    supportsThinking: true,
    supportsVision: false,
    description: 'Arquitectura de razonamiento reforzado para resolución paso a paso de fatiga y Von Mises.',
  },
  {
    id: 'mistralai/mistral-nemo-12b-instruct',
    name: 'Mistral NeMo 12B',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM · mistralai/mistral-nemo-12b-instruct',
    badge: 'Compact',
    shortName: 'Mistral NeMo',
    supportsThinking: false,
    supportsVision: false,
    description: 'Modelo compacto entrenado en colaboración con NVIDIA con ventana de contexto extendida.',
  },
  {
    id: 'qwen/qwen2.5-72b-instruct',
    name: 'Qwen 2.5 72B Instruct',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM · qwen/qwen2.5-72b-instruct',
    badge: 'Math & STEM',
    shortName: 'Qwen 2.5',
    supportsThinking: true,
    supportsVision: false,
    description: 'Especializado en formulación matemática, matrices de transformación y termodinámica.',
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct',
    name: 'NVIDIA Nemotron 70B',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM · nvidia/llama-3.1-nemotron-70b-instruct',
    badge: 'NVIDIA Custom',
    shortName: 'Nemotron 70B',
    supportsThinking: true,
    supportsVision: false,
    description: 'Alineado por NVIDIA con DPO y RLHF para máxima fidelidad a instrucciones de ingeniería.',
  },
];
