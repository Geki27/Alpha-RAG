import { ModelDefinition, ModelProvider } from '../types/models';

export interface ProviderStatus {
  active: boolean;
  authenticated: boolean;
  label: string;
  status: string;
  detectedCount: number;
}

export interface ModelDetectionResponse {
  success: boolean;
  models: ModelDefinition[];
  providers: {
    google: ProviderStatus;
    nvidia: ProviderStatus;
  };
  totalDetected: number;
}

// Default curated Google AI models
const DEFAULT_GOOGLE_MODELS: ModelDefinition[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    providerLabel: 'Google AI · gemini-2.5-flash',
    badge: 'Recomendado',
    shortName: 'Gemini 2.5',
    supportsThinking: true,
    supportsVision: true,
    description: 'Modelo de máxima velocidad y disponibilidad garantizada para inferencia RAG y OCR multimodal.'
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
    description: 'Modelo Gemini 4 de alta velocidad para síntesis RAG y OCR técnico con fórmulas LaTeX.'
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
    description: 'Latencia mínima para consultas rápidas de catálogo y OCR ligero.'
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
    description: 'Modelo de nueva generación (sujeto a picos temporales de demanda del servidor).'
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
    description: 'Modelo de máxima profundidad para cálculos STEM complejos (requiere plan de pago).'
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
    description: 'Modelo de razonamiento avanzado para ingeniería (requiere plan de pago).'
  }
];

// Default curated NVIDIA NIM models (Vision OCR + Text LLM)
const DEFAULT_NVIDIA_MODELS: ModelDefinition[] = [
  {
    id: 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1',
    name: 'Nemotron Nano VL 8B (OCR)',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM · nvidia/llama-3.1-nemotron-nano-vl-8b-v1',
    badge: 'Vision OCR',
    shortName: 'Nemotron VL',
    supportsThinking: false,
    supportsVision: true,
    description: 'Modelo VLM de NVIDIA optimizado para OCR de documentos técnicos, tablas y fórmulas.'
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
    description: 'Modelo multimodal NVIDIA NIM de alta precisión para páginas escaneadas y LaTeX.'
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
    description: 'Modelo multimodal rápido de NVIDIA NIM para OCR de documentos PDF.'
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
    description: 'VLM especializado en OCR matemático, fórmulas LaTeX y esquemas de ingeniería.'
  },
  {
    id: 'meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM · meta/llama-3.3-70b-instruct',
    badge: 'Open Weights',
    shortName: 'Llama 3.3',
    supportsThinking: true,
    supportsVision: false,
    description: 'Microservicio NVIDIA NIM acelerado por TensorRT-LLM para síntesis y derivación técnica.'
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
    description: 'Arquitectura de razonamiento reinforced para resolución paso a paso de fatiga y Von Mises.'
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
    description: 'Modelo compacto entrenado en colaboración con NVIDIA con ventana de contexto extendida.'
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
    description: 'Especializado en formulación matemática, matrices de transformación y termodinámica.'
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
    description: 'Alineado por NVIDIA con DPO y RLHF para máxima fidelidad a instrucciones de ingeniería.'
  }
];

function formatModelName(id: string): string {
  const parts = id.split('/');
  const raw = parts[parts.length - 1] || id;
  return raw
    .replace(/-/g, ' ')
    .replace(/\b([a-z])/g, m => m.toUpperCase())
    .replace(/\b70b\b/i, '70B')
    .replace(/\b8b\b/i, '8B')
    .replace(/\b405b\b/i, '405B')
    .replace(/\b12b\b/i, '12B')
    .replace(/\b72b\b/i, '72B')
    .replace(/\b90b\b/i, '90B')
    .replace(/\b11b\b/i, '11B')
    .replace(/\bvl\b/i, 'VL')
    .replace(/\br1\b/i, 'R1')
    .replace(/\binstruct\b/i, 'Instruct');
}

function isNvidiaVisionModelId(mId: string): boolean {
  const lower = mId.toLowerCase();
  return (
    lower.includes('vision') ||
    lower.includes('-vl') ||
    lower.includes('_vl') ||
    lower.includes('nemotron-nano-vl') ||
    lower.includes('nemotron-parse') ||
    lower.includes('neva') ||
    lower.includes('pixtral') ||
    lower.includes('ocr') ||
    lower.includes('paligemma') ||
    lower.includes('phi-3.5-vision') ||
    lower.includes('phi-4-multimodal') ||
    lower.includes('mistral-small-3.1')
  );
}

export async function detectAvailableModels(): Promise<ModelDetectionResponse> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const nvidiaKey = process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY;

  let googleModels: ModelDefinition[] = [...DEFAULT_GOOGLE_MODELS];
  let isGoogleAuth = Boolean(geminiKey);
  let googleStatus = isGoogleAuth 
    ? 'Online · Google AI Studio API Activa' 
    : 'Local · Catálogo Google AI (Inferencia Simulada / Sandbox)';

  // 1. Try querying real Google AI Models API if API Key is set
  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`, {
        headers: { 'User-Agent': 'aistudio-build' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.models)) {
          const detectedGoogle: ModelDefinition[] = [];
          for (const m of data.models) {
            const nameId = (m.name || '').replace(/^models\//, '');
            if (!nameId || nameId.includes('embedding') || nameId.includes('bison') || nameId.includes('aqa')) continue;
            
            const existing = DEFAULT_GOOGLE_MODELS.find(d => d.id === nameId);
            if (existing) {
              detectedGoogle.push(existing);
            } else if (nameId.includes('gemini')) {
              const displayName = m.displayName || formatModelName(nameId);
              detectedGoogle.push({
                id: nameId,
                name: displayName,
                provider: 'google',
                providerLabel: `Google AI · ${nameId}`,
                badge: nameId.includes('flash') ? 'Fast' : nameId.includes('pro') ? 'Reasoning' : 'Google AI',
                shortName: displayName.split(' ')[0] + ' ' + (displayName.split(' ')[1] || ''),
                supportsThinking: nameId.includes('flash') || nameId.includes('pro') || nameId.includes('thinking'),
                supportsVision: !nameId.includes('tts') && !nameId.includes('lyria'),
                description: m.description || `Modelo autodetectado de Google AI Studio (${nameId}).`
              });
            }
          }

          if (detectedGoogle.length > 0) {
            for (const def of DEFAULT_GOOGLE_MODELS) {
              if (!detectedGoogle.some(d => d.id === def.id)) {
                detectedGoogle.push(def);
              }
            }
            googleModels = detectedGoogle;
            googleStatus = `Online · ${detectedGoogle.length} modelos autodetectados en Google AI`;
          }
        }
      }
    } catch (e: any) {
      console.warn('[Model Detector] Error autodetectando modelos Google AI:', e?.message || e);
    }
  }

  // 2. Try querying NVIDIA NIM OpenAI-compatible models API
  let nvidiaModels: ModelDefinition[] = [...DEFAULT_NVIDIA_MODELS];
  let isNvidiaAuth = Boolean(nvidiaKey);
  let nvidiaStatus = isNvidiaAuth
    ? 'Online · NVIDIA NIM Microservices API Activa'
    : 'Local · Catálogo NVIDIA NIM (TensorRT-LLM)';

  if (nvidiaKey) {
    try {
      const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${nvidiaKey}`,
          'Accept': 'application/json',
          'User-Agent': 'aistudio-build'
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.data)) {
          const detectedNvidia: ModelDefinition[] = [];
          for (const m of data.data) {
            const mId = m.id;
            if (!mId) continue;
            // Filter out embeddings, audio, reward, rerank (keep vision/OCR/parse VLMs!)
            if (mId.includes('embed') || mId.includes('clip') || mId.includes('translate') || mId.includes('reward') || mId.includes('rerank')) continue;

            const existing = DEFAULT_NVIDIA_MODELS.find(d => d.id === mId);
            if (existing) {
              detectedNvidia.push(existing);
            } else {
              const short = formatModelName(mId);
              const isVision = isNvidiaVisionModelId(mId);
              detectedNvidia.push({
                id: mId,
                name: short,
                provider: 'nvidia',
                providerLabel: `NVIDIA NIM · ${mId}`,
                badge: isVision ? 'Vision OCR' : mId.includes('deepseek') ? 'Reasoning' : mId.includes('llama') ? 'TensorRT' : 'NIM',
                shortName: short.split(' ')[0],
                supportsThinking: mId.includes('r1') || mId.includes('70b') || mId.includes('instruct'),
                supportsVision: isVision,
                description: isVision
                  ? `Modelo multimodal NVIDIA NIM para OCR y análisis visual (${mId}).`
                  : `Microservicio NVIDIA NIM acelerado (${mId}).`
              });
            }
          }

          if (detectedNvidia.length > 0) {
            for (const def of DEFAULT_NVIDIA_MODELS) {
              if (!detectedNvidia.some(d => d.id === def.id)) {
                detectedNvidia.unshift(def);
              }
            }
            nvidiaModels = detectedNvidia;
            nvidiaStatus = `Online · ${detectedNvidia.length} modelos LLM/Visión autodetectados en NVIDIA NIM`;
          }
        }
      }
    } catch (e: any) {
      console.warn('[Model Detector] Error autodetectando modelos NVIDIA NIM:', e?.message || e);
    }
  }

  const allModels = [...googleModels, ...nvidiaModels];

  return {
    success: true,
    models: allModels,
    providers: {
      google: {
        active: true,
        authenticated: isGoogleAuth,
        label: 'Google AI Studio',
        status: googleStatus,
        detectedCount: googleModels.length
      },
      nvidia: {
        active: true,
        authenticated: isNvidiaAuth,
        label: 'NVIDIA NIM Microservices',
        status: nvidiaStatus,
        detectedCount: nvidiaModels.length
      }
    },
    totalDetected: allModels.length
  };
}
