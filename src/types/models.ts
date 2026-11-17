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
  // Google AI Models (gemini-2.5-flash is active, verified, and ultra-fast)
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    providerLabel: 'Google AI · gemini-2.5-flash',
    badge: 'Recomendado',
    shortName: 'Gemini 2.5 Flash',
    supportsThinking: true,
    description: 'Modelo de máxima confiabilidad y velocidad para síntesis RAG e ingeniería mecánica.',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'google',
    providerLabel: 'Google AI · gemini-2.5-flash-lite',
    badge: 'Ultra Rápido',
    shortName: 'Flash Lite',
    supportsThinking: true,
    description: 'Latencia mínima para consultas rápidas de catálogo y constantes físicas.',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    provider: 'google',
    providerLabel: 'Google AI · gemini-3.8-flash',
    badge: 'Preview',
    shortName: 'Gemini 3.8',
    supportsThinking: true,
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
    isPaid: true,
    description: 'Razonamiento pro para ingeniería (requiere API key con facturación activa).',
  },
  {
    id: 'nano-banana',
    name: 'Nano Banana',
    provider: 'google',
    providerLabel: 'Google AI · nano-banana',
    badge: 'Vision',
    shortName: 'Nano Banana',
    supportsThinking: false,
    description: 'Modelo ágil para análisis visual de planos, esquemas DCL y diagramas mecánicos.',
  },

  // NVIDIA NIM Models
  {
    id: 'meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM · meta/llama-3.3-70b-instruct',
    badge: 'Open Weights',
    shortName: 'Llama 3.3',
    supportsThinking: true,
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
    description: 'Alineado por NVIDIA con DPO y RLHF para máxima fidelidad a instrucciones de ingeniería.',
  },
];
