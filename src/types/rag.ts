export interface DocumentSource {
  id: string;
  name: string;
  title?: string;
  pages: number;
  chunksCount: number;
  size: string;
  uploadDate: string;
  status: 'indexed' | 'indexing' | 'pending';
  author: string;
  category: string;
  vectorModel: string;
  fileName?: string;
  isExample?: boolean;
  discipline?: string;
  physicalPaths?: {
    pdf: string;
    vector: string;
    txt: string;
  };
}

export interface ChunkItem {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  similarity: number;
  tokenCount: number;
  vectorPreview: number[];
  category: string;
  sectionTitle: string;
  coordinates: { x: number; y: number };
}

export interface GroundedCitation {
  id: string;
  chunkId: string;
  documentName: string;
  pageNumber: number;
  similarityScore: number;
  excerpt: string;
  type?: 'local' | 'web';
  url?: string;
  domain?: string;
}

export interface RagMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: GroundedCitation[];
  metrics?: {
    latencyMs: number;
    retrievalMs: number;
    chunksExamined: number;
    topKUsed: number;
    similarityThreshold: number;
    model: string;
    provider?: string;
    searchScope?: 'local' | 'web' | 'ambas';
    thinkingEffort?: string;
    webQueries?: string[];
  };
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: RagMessage[];
}

export type ActiveTab = 'query' | 'vectors' | 'documents' | 'pipeline';
