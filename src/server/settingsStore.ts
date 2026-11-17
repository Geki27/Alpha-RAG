import fs from 'fs';
import path from 'path';
import { ROOT_LIBRARY_DIR, ensureLibraryDirectories } from './libraryStorage';
import {
  DEFAULT_RUNTIME_SETTINGS,
  ProviderKeyInfo,
  PublicSettingsPayload,
  RuntimeTaskSettings,
  UpdateSettingsPayload,
} from '../types/settings';

const SETTINGS_FILE = path.join(ROOT_LIBRARY_DIR, '.aether-settings.json');
const ENV_LOCAL_PATH = path.resolve(process.cwd(), '.env.local');

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function sanitizeSettings(raw: Partial<RuntimeTaskSettings> | undefined, base: RuntimeTaskSettings): RuntimeTaskSettings {
  if (!raw) return base;
  const quality = raw.ocrQuality === 'fast' || raw.ocrQuality === 'balanced' || raw.ocrQuality === 'high'
    ? raw.ocrQuality
    : base.ocrQuality;

  return {
    chatModel: typeof raw.chatModel === 'string' && raw.chatModel.trim() ? raw.chatModel.trim() : base.chatModel,
    visionOcrModel: typeof raw.visionOcrModel === 'string' && raw.visionOcrModel.trim() ? raw.visionOcrModel.trim() : base.visionOcrModel,
    webSearchModel: typeof raw.webSearchModel === 'string' && raw.webSearchModel.trim() ? raw.webSearchModel.trim() : base.webSearchModel,
    embeddingModel: typeof raw.embeddingModel === 'string' && raw.embeddingModel.trim() ? raw.embeddingModel.trim() : base.embeddingModel,

    visionOcrEnabled: typeof raw.visionOcrEnabled === 'boolean' ? raw.visionOcrEnabled : base.visionOcrEnabled,
    ocrMaxPagesPerDoc: Math.round(clampNumber(raw.ocrMaxPagesPerDoc, 0, 500, base.ocrMaxPagesPerDoc)),
    ocrMaxFileSizeMb: Math.round(clampNumber(raw.ocrMaxFileSizeMb, 1, 100, base.ocrMaxFileSizeMb)),
    ocrQuality: quality,
    ocrTimeoutSeconds: Math.round(clampNumber(raw.ocrTimeoutSeconds, 10, 300, base.ocrTimeoutSeconds)),
    ocrStrictLatex: typeof raw.ocrStrictLatex === 'boolean' ? raw.ocrStrictLatex : base.ocrStrictLatex,

    topK: Math.round(clampNumber(raw.topK, 1, 12, base.topK)),
    temperature: Number(clampNumber(raw.temperature, 0, 1, base.temperature).toFixed(2)),
    rerankEnabled: typeof raw.rerankEnabled === 'boolean' ? raw.rerankEnabled : base.rerankEnabled,
    similarityThreshold: Number(clampNumber(raw.similarityThreshold, 0.1, 0.95, base.similarityThreshold).toFixed(2)),
    llmTimeoutSeconds: Math.round(clampNumber(raw.llmTimeoutSeconds, 10, 180, base.llmTimeoutSeconds)),
  };
}

export function getRuntimeSettings(): RuntimeTaskSettings {
  ensureLibraryDirectories();
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      return sanitizeSettings(parsed, DEFAULT_RUNTIME_SETTINGS);
    }
  } catch (err) {
    console.warn('[Settings Store] Error leyendo configuración persistida:', err);
  }
  return { ...DEFAULT_RUNTIME_SETTINGS };
}

function maskKey(value: string | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}••••••${trimmed.slice(-4)}`;
}

function readEnvLocalMap(): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(ENV_LOCAL_PATH)) return map;
  const lines = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let val = trimmed.slice(eqIndex + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
  }
  return map;
}

function writeEnvLocalUpdates(updates: Record<string, string | null>): void {
  const existingLines = fs.existsSync(ENV_LOCAL_PATH)
    ? fs.readFileSync(ENV_LOCAL_PATH, 'utf-8').split(/\r?\n/)
    : ['# Claves locales generadas desde Ajustes (ignorado por Git)'];

  const handledKeys = new Set<string>();
  const nextLines: string[] = [];

  for (const line of existingLines) {
    const trimmed = line.trim();
    const eqIndex = trimmed.indexOf('=');
    if (trimmed && !trimmed.startsWith('#') && eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        handledKeys.add(key);
        const nextVal = updates[key];
        if (nextVal !== null && nextVal !== '') {
          nextLines.push(`${key}="${nextVal.replace(/"/g, '\\"')}"`);
        }
        continue;
      }
    }
    nextLines.push(line);
  }

  for (const [key, nextVal] of Object.entries(updates)) {
    if (!handledKeys.has(key) && nextVal !== null && nextVal !== '') {
      nextLines.push(`${key}="${nextVal.replace(/"/g, '\\"')}"`);
    }
  }

  const finalText = nextLines.filter((l, idx, arr) => !(idx === arr.length - 1 && l === '')).join('\n') + '\n';
  fs.writeFileSync(ENV_LOCAL_PATH, finalText, 'utf-8');
}

function getProviderKeyInfo(envVal: string | undefined, envLocalMap: Map<string, string>, keyNames: string[]): ProviderKeyInfo {
  const localDefined = keyNames.some((k) => {
    const v = envLocalMap.get(k);
    return Boolean(v && v.trim().length > 0);
  });
  const activeVal = (envVal || '').trim();
  if (!activeVal) {
    return { configured: false, masked: '', source: 'none' };
  }
  return {
    configured: true,
    masked: maskKey(activeVal),
    source: localDefined ? 'local' : 'env',
  };
}

export function getPublicSettings(): PublicSettingsPayload {
  const envLocalMap = readEnvLocalMap();
  return {
    settings: getRuntimeSettings(),
    providers: {
      gemini: getProviderKeyInfo(process.env.GEMINI_API_KEY, envLocalMap, ['GEMINI_API_KEY']),
      nvidia: getProviderKeyInfo(
        process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY,
        envLocalMap,
        ['NVIDIA_NIM_API_KEY', 'NVIDIA_API_KEY']
      ),
    },
  };
}

export function updateRuntimeSettings(payload: UpdateSettingsPayload): PublicSettingsPayload {
  ensureLibraryDirectories();
  const current = getRuntimeSettings();
  const nextSettings = sanitizeSettings(payload.settings, current);
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(nextSettings, null, 2), 'utf-8');

  if (payload.apiKeys) {
    const envUpdates: Record<string, string | null> = {};

    if (payload.apiKeys.clearGemini) {
      delete process.env.GEMINI_API_KEY;
      envUpdates.GEMINI_API_KEY = null;
    } else if (typeof payload.apiKeys.geminiApiKey === 'string' && payload.apiKeys.geminiApiKey.trim()) {
      const cleaned = payload.apiKeys.geminiApiKey.trim();
      process.env.GEMINI_API_KEY = cleaned;
      envUpdates.GEMINI_API_KEY = cleaned;
    }

    if (payload.apiKeys.clearNvidia) {
      delete process.env.NVIDIA_NIM_API_KEY;
      delete process.env.NVIDIA_API_KEY;
      envUpdates.NVIDIA_NIM_API_KEY = null;
      envUpdates.NVIDIA_API_KEY = null;
    } else if (typeof payload.apiKeys.nvidiaApiKey === 'string' && payload.apiKeys.nvidiaApiKey.trim()) {
      const cleaned = payload.apiKeys.nvidiaApiKey.trim();
      process.env.NVIDIA_NIM_API_KEY = cleaned;
      envUpdates.NVIDIA_NIM_API_KEY = cleaned;
    }

    if (Object.keys(envUpdates).length > 0) {
      writeEnvLocalUpdates(envUpdates);
    }
  }

  return getPublicSettings();
}

export function resetRuntimeSettings(): PublicSettingsPayload {
  ensureLibraryDirectories();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_RUNTIME_SETTINGS, null, 2), 'utf-8');
  return getPublicSettings();
}
