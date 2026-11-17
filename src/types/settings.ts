export type OcrQualityLevel = 'fast' | 'balanced' | 'high';

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
};
