import { EffortLevel } from './models';

export type OcrQualityLevel = 'fast' | 'balanced' | 'high';
export type PersistedSearchScope = 'local' | 'web' | 'ambas';
export type PersistedActiveTab = 'query' | 'vectors' | 'documents' | 'pipeline';

export type ChunkStrategyType = 'semantic' | 'recursive' | 'sliding' | 'pages';

export interface RuntimeTaskSettings {
  // Task-specific models
  chatModel: string;
  visionOcrModel: string;
  webSearchModel: string; // 'auto' means follow active chatModel
  embeddingModel: string;

  // Vision OCR extraction limits & options
  visionOcrEnabled: boolean;
  ocrMaxPagesPerDoc: number; // 0 = unlimited
  ocrMaxFileSizeMb: number;
  ocrQuality: OcrQualityLevel;
  ocrTimeoutSeconds: number;
  ocrStrictLatex: boolean;

  // RAG engine hyperparameters
  topK: number;
  temperature: number;
  rerankEnabled: boolean;
  similarityThreshold: number;
  llmTimeoutSeconds: number;

  // WebGL Background & Workspace preferences
  particleSpeed: number;
  pointSize: number;
  vignetteDarkness: number;
  lockedIntrospect: boolean;
  thinkingEnabled: boolean;
  effortLevel: EffortLevel;
  searchScope: PersistedSearchScope;
  hideExamples: boolean;
  deletedSeedFiles: string[];
  activeTab: PersistedActiveTab;
  sidebarOpen: boolean;

  // Library ingestion & chunking preferences
  chunkStrategy: ChunkStrategyType;
  chunkSize: number;
  chunkOverlap: number;
  uploadDiscipline: string;
  activeDiscipline: string;
}

export interface ProviderKeyInfo {
  configured: boolean;
  masked: string;
  source: 'env' | 'local' | 'none';
}

export interface PublicSettingsPayload {
  settings: RuntimeTaskSettings;
  providers: {
    gemini: ProviderKeyInfo;
    nvidia: ProviderKeyInfo;
  };
}

export interface UpdateSettingsPayload {
  settings?: Partial<RuntimeTaskSettings>;
  detectModels?: boolean;
  apiKeys?: {
    geminiApiKey?: string;
    nvidiaApiKey?: string;
    clearGemini?: boolean;
    clearNvidia?: boolean;
  };
}

export const DEFAULT_RUNTIME_SETTINGS: RuntimeTaskSettings = {
  chatModel: 'gemini-2.5-flash',
  visionOcrModel: 'gemini-2.5-flash',
  webSearchModel: 'auto',
  embeddingModel: 'text-embedding-004',

  visionOcrEnabled: true,
  ocrMaxPagesPerDoc: 25,
  ocrMaxFileSizeMb: 18,
  ocrQuality: 'balanced',
  ocrTimeoutSeconds: 45,
  ocrStrictLatex: true,

  topK: 5,
  temperature: 0.1,
  rerankEnabled: true,
  similarityThreshold: 0.5,
  llmTimeoutSeconds: 45,

  particleSpeed: 1.0,
  pointSize: 10.0,
  vignetteDarkness: 1.5,
  lockedIntrospect: false,
  thinkingEnabled: true,
  effortLevel: 'medium',
  searchScope: 'local',
  hideExamples: false,
  deletedSeedFiles: [],
  activeTab: 'query',
  sidebarOpen: false,

  chunkStrategy: 'semantic',
  chunkSize: 512,
  chunkOverlap: 64,
  uploadDiscipline: 'Estatica',
  activeDiscipline: 'ALL',
};
