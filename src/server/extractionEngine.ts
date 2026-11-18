import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { GoogleGenAI, Type } from '@google/genai';
import {
  ROOT_LIBRARY_DIR,
  ensureLibraryDirectories,
  SEED_BOOK_FILENAMES,
  getPhysicalLibraryTree,
  LibraryBookFile,
} from './libraryStorage';
import { getRuntimeSettings } from './settingsStore';

export type OcrProvider = 'google' | 'nvidia';

export interface ReconstructedFormula {
  id: string;
  pageNumber: number;
  source: 'python_native' | 'ocr_vision';
  displayMode: 'block' | 'inline';
  raw: string;
  latex: string;
  json: {
    type: 'equation' | 'inequality' | 'expression';
    lhs: string;
    operator: string | null;
    rhs: string | null;
    variables: string[];
  };
}

export interface PageExtractionDetail {
  pageNumber: number;
  source: 'python_native' | 'ocr_vision' | 'empty';
  isScanned: boolean;
  charCount: number;
  alnumCount: number;
  wordCount: number;
  formulasCount: number;
  ocrModel?: string;
  ocrProvider?: OcrProvider;
  note?: string;
}

export interface ExtractionJob {
  id: string;
  discipline: string;
  fileName: string;
  originalFilePath: string;
  totalPages: number;
  currentPage: number;
  nativePagesCount?: number;
  scannedPagesCount?: number;
  ocrProcessedCount?: number;
  formulasCount?: number;
  extractionEngine?: string;
  rateLimitPolicy?: string;
  status: 'pending' | 'triaging' | 'ocr_extracting' | 'latex_parsing' | 'vectorizing' | 'completed' | 'error';
  progress: number;
  stageMessage: string;
  extractedMarkdown: string;
  chunksCount: number;
  error?: string;
}

// In-memory jobs registry for tracking
export const activeExtractionJobs = new Map<string, ExtractionJob>();

// Strict per-provider OCR rate limits (pages per minute)
export const GEMINI_OCR_MAX_PAGES_PER_MIN = 14;
export const NVIDIA_OCR_MAX_PAGES_PER_MIN = 38;
const OCR_RATE_WINDOW_MS = 60_500; // 60s + 500ms clock/network safety margin

/**
 * Sliding-window per-provider rate limiter ensuring:
 * - Gemini <= 14 pages/min
 * - NVIDIA <= 38 pages/min
 */
export class ProviderOcrRateLimiter {
  private timestamps: Record<OcrProvider, number[]> = {
    google: [],
    nvidia: [],
  };

  private locks: Record<OcrProvider, Promise<void>> = {
    google: Promise.resolve(),
    nvidia: Promise.resolve(),
  };

  public getLimit(provider: OcrProvider): number {
    return provider === 'nvidia' ? NVIDIA_OCR_MAX_PAGES_PER_MIN : GEMINI_OCR_MAX_PAGES_PER_MIN;
  }

  public getWindowSnapshot(provider: OcrProvider, now = Date.now()): number {
    const cutoff = now - OCR_RATE_WINDOW_MS;
    this.timestamps[provider] = this.timestamps[provider].filter((ts) => ts > cutoff);
    return this.timestamps[provider].length;
  }

  public async acquireSlot(
    provider: OcrProvider,
    onWait?: (waitMs: number, limit: number) => void
  ): Promise<void> {
    const limit = this.getLimit(provider);

    const run = this.locks[provider].then(async () => {
      while (true) {
        const now = Date.now();
        const cutoff = now - OCR_RATE_WINDOW_MS;
        this.timestamps[provider] = this.timestamps[provider].filter((ts) => ts > cutoff);

        if (this.timestamps[provider].length < limit) {
          this.timestamps[provider].push(Date.now());
          return;
        }

        const oldest = this.timestamps[provider][0];
        const waitMs = Math.max(250, oldest + OCR_RATE_WINDOW_MS - now);
        if (onWait) {
          onWait(waitMs, limit);
        }
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    });

    // Keep lock chain alive even if caller errors later
    this.locks[provider] = run.catch(() => {});
    return run;
  }
}

export const ocrRateLimiter = new ProviderOcrRateLimiter();

export function resolveOcrProvider(modelId: string): OcrProvider {
  const normalized = (modelId || '').trim().toLowerCase();
  if (
    normalized.includes('/') ||
    normalized.startsWith('meta/') ||
    normalized.startsWith('nvidia/') ||
    normalized.startsWith('deepseek') ||
    normalized.startsWith('mistralai/') ||
    normalized.startsWith('qwen/') ||
    normalized.startsWith('microsoft/')
  ) {
    return 'nvidia';
  }
  return 'google';
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ============================================================================
// PYTHON BRIDGE (scripts/extract_pdf.py)
// ============================================================================
interface PythonPageResult {
  pageNumber: number;
  text: string;
  charCount: number;
  alnumCount: number;
  wordCount: number;
  corruptedRatio: number;
  readableRatio: number;
  imageCount: number;
  hasTextOperators: boolean;
  isScanned: boolean;
  needsNodeTextCheck: boolean;
  renderedImagePath: string | null;
}

interface PythonExtractionResponse {
  success: boolean;
  engine: string;
  totalPages: number;
  metadata?: { title?: string; author?: string };
  pages: PythonPageResult[];
  error?: string;
}

let cachedPythonCmd: { cmd: string; prefixArgs: string[] } | null = null;

function spawnAndCapture(
  cmd: string,
  args: string[],
  timeoutMs = 120_000
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try {
          child.kill('SIGKILL');
        } catch {}
        reject(new Error(`Timeout (${Math.round(timeoutMs / 1000)}s) ejecutando ${cmd}`));
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf-8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf-8');
    });
    child.on('error', (err) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        reject(err);
      }
    });
    child.on('close', (code) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({ code: code ?? 1, stdout, stderr });
      }
    });
  });
}

async function resolvePythonCommand(): Promise<{ cmd: string; prefixArgs: string[] } | null> {
  if (cachedPythonCmd) return cachedPythonCmd;

  const candidates: Array<{ cmd: string; prefixArgs: string[] }> =
    process.platform === 'win32'
      ? [
          { cmd: 'python', prefixArgs: [] },
          { cmd: 'py', prefixArgs: ['-3'] },
          { cmd: 'python3', prefixArgs: [] },
        ]
      : [
          { cmd: 'python3', prefixArgs: [] },
          { cmd: 'python', prefixArgs: [] },
        ];

  for (const cand of candidates) {
    try {
      const res = await spawnAndCapture(cand.cmd, [...cand.prefixArgs, '--version'], 5000);
      if (res.code === 0 && (res.stdout + res.stderr).toLowerCase().includes('python 3')) {
        cachedPythonCmd = cand;
        return cand;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function runPythonPdfExtractor(
  pdfPath: string,
  dpi: number
): Promise<PythonExtractionResponse | null> {
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'extract_pdf.py');
  if (!fs.existsSync(scriptPath)) {
    console.warn('[PDF Extraction] No se encontró scripts/extract_pdf.py');
    return null;
  }

  const py = await resolvePythonCommand();
  if (!py) {
    console.warn('[PDF Extraction] Python 3 no está disponible en el sistema.');
    return null;
  }

  try {
    const res = await spawnAndCapture(
      py.cmd,
      [...py.prefixArgs, scriptPath, pdfPath, '--mode', 'extract', '--dpi', String(dpi)],
      120_000
    );

    if (res.code !== 0) {
      console.warn('[Python PDF Extractor] Exit code:', res.code, res.stderr.slice(0, 300));
      return null;
    }

    const parsed = JSON.parse(res.stdout.trim()) as PythonExtractionResponse;
    if (!parsed || !parsed.success || !Array.isArray(parsed.pages)) {
      return null;
    }
    return parsed;
  } catch (err: any) {
    console.warn('[Python PDF Extractor] Error ejecutando extracción Python:', err?.message || err);
    return null;
  }
}

async function renderScannedPagesWithPython(
  pdfPath: string,
  pageNumbers: number[],
  renderDir: string,
  dpi: number
): Promise<Record<number, string | null>> {
  const result: Record<number, string | null> = {};
  if (pageNumbers.length === 0) return result;

  const scriptPath = path.resolve(process.cwd(), 'scripts', 'extract_pdf.py');
  const py = await resolvePythonCommand();
  if (!py || !fs.existsSync(scriptPath)) return result;

  try {
    const res = await spawnAndCapture(
      py.cmd,
      [
        ...py.prefixArgs,
        scriptPath,
        pdfPath,
        '--mode',
        'render-pages',
        '--pages',
        pageNumbers.join(','),
        '--render-dir',
        renderDir,
        '--dpi',
        String(dpi),
      ],
      120_000
    );

    if (res.code === 0) {
      const parsed = JSON.parse(res.stdout.trim());
      if (parsed?.success && parsed?.rendered) {
        for (const [k, v] of Object.entries(parsed.rendered)) {
          const pNum = parseInt(k, 10);
          if (!Number.isNaN(pNum)) {
            result[pNum] = typeof v === 'string' && fs.existsSync(v) ? v : null;
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[Python Page Renderer] Error renderizando páginas escaneadas:', err?.message || err);
  }

  return result;
}

// ============================================================================
// PER-PAGE CONTENT CLASSIFIER (Real Content vs Scanned)
// ============================================================================
export function classifyPageContent(
  text: string,
  options: { imageCount?: number; invisibleTextRatio?: number } = {}
): {
  isScanned: boolean;
  charCount: number;
  alnumCount: number;
  wordCount: number;
  corruptedRatio: number;
  readableRatio: number;
} {
  const cleaned = (text || '').replace(/\r\n/g, '\n').trim();
  const nonWs = cleaned.replace(/\s+/g, '');
  const charCount = nonWs.length;

  const alnumMatches = nonWs.match(/[\p{L}\p{N}]/gu) || [];
  const alnumCount = alnumMatches.length;

  let corruptedCount = 0;
  for (let i = 0; i < nonWs.length; i++) {
    const code = nonWs.charCodeAt(i);
    if (code === 0xfffd || code < 32 || (code >= 0xe000 && code <= 0xf8ff)) {
      corruptedCount++;
    }
  }

  const corruptedRatio = charCount > 0 ? corruptedCount / charCount : 0;
  const readableRatio = charCount > 0 ? alnumCount / charCount : 0;
  const words = cleaned.match(/[\p{L}\p{N}]{2,}/gu) || [];
  const wordCount = words.length;
  const imageCount = options.imageCount ?? 0;

  const isCorrupted = charCount > 0 && corruptedRatio > 0.15;

  // Real extracted digital text: sufficient readable characters & words, not corrupted
  let hasRealContent =
    !isCorrupted &&
    alnumCount >= 25 &&
    wordCount >= 4 &&
    readableRatio >= 0.30;

  // Allow short valid digital pages (title/cover/section divider) with no image scan
  if (
    !hasRealContent &&
    !isCorrupted &&
    imageCount === 0 &&
    alnumCount >= 12 &&
    wordCount >= 2 &&
    readableRatio >= 0.45
  ) {
    hasRealContent = true;
  }

  return {
    isScanned: !hasRealContent,
    charCount,
    alnumCount,
    wordCount,
    corruptedRatio: Number(corruptedRatio.toFixed(4)),
    readableRatio: Number(readableRatio.toFixed(4)),
  };
}

/**
 * Legacy helper preserved for compatibility; inspects binary PDF operators.
 */
export function inspectPageMode(buffer: Buffer): { isScanned: boolean; confidence: number } {
  const content = buffer.toString('binary');
  const hasTextOperators = content.includes('BT') && (content.includes('Tj') || content.includes('TJ'));
  const hasImageStreams =
    content.includes('/Image') || content.includes('/DCTDecode') || content.includes('/JPXDecode');

  if (hasTextOperators && !hasImageStreams) {
    return { isScanned: false, confidence: 0.95 };
  } else if (!hasTextOperators && hasImageStreams) {
    return { isScanned: true, confidence: 0.92 };
  }
  return { isScanned: !hasTextOperators, confidence: 0.75 };
}

// ============================================================================
// FORMULA RECONSTRUCTION: LATEX & STRUCTURED JSON
// ============================================================================
const UNICODE_GREEK_TO_LATEX: Array<[RegExp, string]> = [
  [/σ/g, '\\sigma'],
  [/τ/g, '\\tau'],
  [/ε/g, '\\varepsilon'],
  [/θ/g, '\\theta'],
  [/φ/g, '\\phi'],
  [/ω/g, '\\omega'],
  [/π/g, '\\pi'],
  [/α/g, '\\alpha'],
  [/β/g, '\\beta'],
  [/γ/g, '\\gamma'],
  [/λ/g, '\\lambda'],
  [/μ/g, '\\mu'],
  [/ρ/g, '\\rho'],
  [/η/g, '\\eta'],
  [/Δ/g, '\\Delta'],
  [/Σ/g, '\\sum'],
  [/Π/g, '\\prod'],
  [/Ω/g, '\\Omega'],
  [/±/g, '\\pm'],
  [/×/g, '\\times'],
  [/·/g, '\\cdot'],
  [/÷/g, '\\div'],
  [/≤/g, '\\le'],
  [/≥/g, '\\ge'],
  [/≠/g, '\\neq'],
  [/≈/g, '\\approx'],
  [/∞/g, '\\infty'],
  [/∫/g, '\\int'],
  [/∂/g, '\\partial'],
  [/°/g, '^\\circ'],
  [/²/g, '^2'],
  [/³/g, '^3'],
  [/⁻¹/g, '^{-1}'],
];

const ASCII_GREEK_NAMES: Array<[RegExp, string]> = [
  [/(?<![\\A-Za-z])(sigma|tau|theta|phi|omega|alpha|beta|gamma|lambda|mu|rho|eta|delta|Delta|Omega|Sigma)(?=[^A-Za-z]|$)/g, '\\$1'],
];

function convertMathExpressionToLatex(expr: string): string {
  let out = expr.trim();
  // Convert spelled-out Greek names inside math expressions (e.g. sigma_max -> \sigma_max)
  for (const [rx, rep] of ASCII_GREEK_NAMES) {
    out = out.replace(rx, rep);
  }
  // Normalize multi-char subscripts on Greek/Latin symbols before expanding Unicode Greek tokens
  out = out.replace(/(\\[A-Za-z]+|[A-Za-zστθφωαβγλμρηΔΩ])_([A-Za-z0-9']{2,})/g, (_m, v, sub) => `${v}_{${sub}}`);
  for (const [rx, rep] of UNICODE_GREEK_TO_LATEX) {
    out = out.replace(rx, () => `${rep} `);
  }
  // Remove spaces inserted right before _ or ^ (e.g. "\sigma _v" -> "\sigma_v")
  out = out.replace(/(\\[A-Za-z]+)\s+([_^])/g, '$1$2');
  out = out.replace(/(?:sum|SUM)\s+([A-Za-z])/g, (_m, v) => `\\sum ${v}`);
  out = out.replace(/sqrt\s*\(([^()]+)\)/gi, (_m, inner) => `\\sqrt{${inner.trim()}}`);
  out = out.replace(/√\s*\(([^()]+)\)/g, (_m, inner) => `\\sqrt{${inner.trim()}}`);
  out = out.replace(/√([A-Za-z0-9_]+)/g, (_m, inner) => `\\sqrt{${inner}}`);
  out = out.replace(/\b(sin|cos|tan|ln|log|exp)\b\s*\(/gi, (_m, fn) => `\\${fn.toLowerCase()}(`);
  out = out.replace(/\s*\*\s*/g, ' \\cdot ');
  out = out.replace(/\s{2,}/g, ' ').trim();
  return out;
}

/**
 * Reconstructs plain-text & Unicode engineering formulas to LaTeX ($...$ / $$...$$),
 * skipping any existing $...$, $$...$$, or fenced code blocks so delimiters are never corrupted.
 */
export function normalizeFormulasToLatex(text: string): string {
  if (!text) return '';

  // Protect existing $$...$$, $...$, and ```...``` segments
  const protectedPattern = /(```[\s\S]*?```|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  const segments = text.split(protectedPattern);

  const transformPlainSegment = (seg: string): string => {
    let s = seg;

    // 1. Canonical engineering equilibrium & physics equations
    s = s.replace(/(?:sum|SUM|Σ|\\sum)\s*F_?x\s*=\s*0/gi, () => '$$\\sum F_x = 0$$');
    s = s.replace(/(?:sum|SUM|Σ|\\sum)\s*F_?y\s*=\s*0/gi, () => '$$\\sum F_y = 0$$');
    s = s.replace(/(?:sum|SUM|Σ|\\sum)\s*F_?z\s*=\s*0/gi, () => '$$\\sum F_z = 0$$');
    s = s.replace(
      /(?:sum|SUM|Σ|\\sum)\s*M_?([A-Za-z0-9]+)\s*=\s*0/gi,
      (_m, p1) => `$$\\sum M_{${p1}} = 0$$`
    );
    s = s.replace(/\bF\s*=\s*m\s*\*\s*a\b/gi, () => '$$\\vec{F} = m \\cdot \\vec{a}$$');

    // 2. Standalone equation lines (not already wrapped in $)
    const lines = s.split('\n');
    const processedLines = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.includes('$') || trimmed.startsWith('#') || trimmed.startsWith('|')) {
        return line;
      }

      // Check if line looks like a standalone mathematical/engineering formula:
      // e.g. "sigma = F / A", "σ_v = √(σ_1^2 - σ_1*σ_2 + σ_2^2)", "S_e = k_a * k_b * S_e'"
      const hasMathOperator = /[=≤≥≈≠]/.test(trimmed);
      const hasMathSymbols =
        /[στθφωαβγλμρηΔΣΠΩ√∫∂²³±×·÷]/.test(trimmed) ||
        /\b(?:sqrt|sin|cos|tan|ln|log|exp)\s*\(/i.test(trimmed) ||
        /[A-Za-z]_[A-Za-z0-9]+/.test(trimmed) ||
        /\^[0-9{(]/.test(trimmed) ||
        (/\s\/\s/.test(trimmed) && trimmed.length <= 90);

      // Avoid converting normal prose sentences that happen to contain "="
      const proseWordsCount = (trimmed.match(/\b[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4,}\b/g) || []).length;

      if (hasMathOperator && hasMathSymbols && trimmed.length <= 160 && proseWordsCount <= 3) {
        const latexBody = convertMathExpressionToLatex(trimmed);
        return `$$${latexBody}$$`;
      }

      // Inline formula patterns inside prose lines (e.g. "donde σ = F / A y τ = V / A")
      return line.replace(
        /(?<![\w$])([στθφωαβγλμρηΔΣ][A-Za-z0-9_']*|[A-Za-z]_[A-Za-z0-9]+)\s*=\s*([A-Za-z0-9_στθφωαβγλμρηΔΣ+\-*/^().\s]{1,40})(?=[,.;)\n]|$)/g,
        (full, lhs, rhs) => {
          const cleanRhs = rhs.trim();
          if (!cleanRhs || cleanRhs.split(/\s+/).length > 7) return full;
          return `$${convertMathExpressionToLatex(`${lhs} = ${cleanRhs}`)}$`;
        }
      );
    });

    return processedLines.join('\n');
  };

  return segments
    .map((part, idx) => (idx % 2 === 1 ? part : transformPlainSegment(part)))
    .join('');
}

function parseFormulaToJsonAst(latex: string): ReconstructedFormula['json'] {
  const clean = latex
    .replace(/^\$\$|\$\$$/g, '')
    .replace(/^\$|\$$/g, '')
    .trim();

  const opMatch = clean.match(/(\\le|\\ge|\\neq|\\approx|=|<|>|≤|≥|≠|≈)/);
  let lhs = clean;
  let operator: string | null = null;
  let rhs: string | null = null;
  let type: 'equation' | 'inequality' | 'expression' = 'expression';

  if (opMatch && opMatch.index !== undefined) {
    operator = opMatch[1];
    lhs = clean.slice(0, opMatch.index).trim();
    rhs = clean.slice(opMatch.index + operator.length).trim();
    type = operator === '=' ? 'equation' : 'inequality';
  }

  // Extract variable identifiers cleanly (handling commands with subscripts like \sigma_{max} and ASCII symbols like F_x)
  const varTokens: string[] = [];
  const cmdVarMatches = clean.match(/\\(?:sigma|tau|varepsilon|theta|phi|omega|pi|alpha|beta|gamma|lambda|mu|rho|eta|Delta|Omega)(?:_\{[A-Za-z0-9']+\}|_[A-Za-z0-9'])?/g) || [];
  for (const cv of cmdVarMatches) {
    varTokens.push(cv.replace(/^\\/, ''));
  }
  const withoutCommandsAndBracedSubs = clean
    .replace(/\\[A-Za-z]+(?:_\{[^}]+\}|_[A-Za-z0-9'])?/g, ' ')
    .replace(/_\{([^}]+)\}/g, '_$1');
  const asciiMatches = withoutCommandsAndBracedSubs.match(/\b[A-Za-z](?:_[A-Za-z0-9']+)?\b/g) || [];
  for (const av of asciiMatches) {
    varTokens.push(av);
  }
  const variables = Array.from(new Set(varTokens)).slice(0, 16);

  return {
    type,
    lhs,
    operator,
    rhs,
    variables,
  };
}

export function extractFormulasAsJson(
  pageMarkdown: string,
  pageNumber: number,
  source: 'python_native' | 'ocr_vision',
  ocrProvidedFormulas: Array<{ raw?: string; latex?: string; displayMode?: string }> = []
): ReconstructedFormula[] {
  const formulas: ReconstructedFormula[] = [];
  const seenLatex = new Set<string>();
  let counter = 0;

  const pushFormula = (raw: string, latex: string, displayMode: 'block' | 'inline') => {
    const cleanLatex = latex
      .replace(/^\$\$|\$\$$/g, '')
      .replace(/^\$|\$$/g, '')
      .trim();
    if (!cleanLatex || cleanLatex.length < 2) return;
    if (seenLatex.has(cleanLatex)) return;
    seenLatex.add(cleanLatex);
    counter++;
    formulas.push({
      id: `eq-p${pageNumber}-${counter}`,
      pageNumber,
      source,
      displayMode,
      raw: raw.trim() || cleanLatex,
      latex: cleanLatex,
      json: parseFormulaToJsonAst(cleanLatex),
    });
  };

  // 1. Prioritize structured formulas provided directly by Vision OCR JSON
  for (const item of ocrProvidedFormulas) {
    if (item?.latex) {
      pushFormula(
        item.raw || item.latex,
        item.latex,
        item.displayMode === 'inline' ? 'inline' : 'block'
      );
    }
  }

  // 2. Scan $$...$$ display blocks and $...$ inline math in page Markdown
  const blockRx = /\$\$([\s\S]+?)\$\$/g;
  let m: RegExpExecArray | null;
  while ((m = blockRx.exec(pageMarkdown)) !== null) {
    pushFormula(m[0], m[1], 'block');
  }

  const withoutBlocks = pageMarkdown.replace(/\$\$[\s\S]+?\$\$/g, ' ');
  const inlineRx = /\$([^$\n]+?)\$/g;
  while ((m = inlineRx.exec(withoutBlocks)) !== null) {
    const inner = m[1].trim();
    // Only index meaningful formulas (containing operators, commands, or sub/superscripts)
    if (/[=<>^_\\+\-*/]|\\(?:sigma|tau|sum|frac|sqrt|int|Delta)/.test(inner)) {
      pushFormula(m[0], inner, 'inline');
    }
  }

  return formulas;
}

// ============================================================================
// PER-PAGE OCR FALLBACK (GEMINI <= 14/min | NVIDIA NIM <= 38/min)
// ============================================================================
interface SinglePageOcrResult {
  markdown: string;
  formulas: Array<{ raw?: string; latex?: string; displayMode?: string }>;
}

function buildPageOcrPrompt(
  fileName: string,
  pageNumber: number,
  totalPages: number,
  strictLatex: boolean,
  quality: string,
  expectJsonOutput: boolean,
  isFullPdfAttachment = false
): string {
  const latexInstruction = strictLatex
    ? 'Reconstruye TODAS las ecuaciones y expresiones matemáticas en LaTeX estricto ($...$ en línea, $$...$$ en bloque).'
    : 'Conserva todas las ecuaciones matemáticas en formato LaTeX ($...$ / $$...$$) o texto técnico claro.';

  const qualityInstruction =
    quality === 'high'
      ? 'Transcribe exhaustivamente celda por celda cada tabla en Markdown, subíndices, exponentes, unidades y rótulos de diagramas.'
      : quality === 'fast'
        ? 'Extrae de forma directa los párrafos principales, encabezados, tablas clave y fórmulas.'
        : 'Mantén equilibrio entre fidelidad técnica en fórmulas/tablas y claridad estructural.';

  const scopeHint = isFullPdfAttachment
    ? `IMPORTANTE: El archivo adjunto es el PDF completo; extrae ÚNICAMENTE el contenido de la página ${pageNumber} de ${totalPages}, ignorando el resto de las páginas.`
    : `Extrae fielmente el contenido de esta página (${pageNumber} de ${totalPages}).`;

  if (expectJsonOutput) {
    return `Eres un motor OCR técnico de ingeniería para la página ${pageNumber} de ${totalPages} del documento "${fileName}".
${scopeHint}
${qualityInstruction}
Reglas obligatorias:
1. NO inventes contenido ni añadas comentarios introductorios.
2. NO incluyas el encabezado "## PÁGINA ${pageNumber}" dentro del campo markdown (el sistema lo agrega automáticamente).
3. ${latexInstruction}
4. Preserva fielmente materiales, normas, valores numéricos, tablas Markdown y unidades.
5. Devuelve EXCLUSIVAMENTE un objeto JSON válido con:
   - "markdown": texto completo de la página en Markdown limpio con fórmulas en LaTeX ($...$ / $$...$$).
   - "formulas": arreglo de todas las fórmulas reconstruidas encontradas en esta página, cada una con { "raw", "latex", "displayMode": "block" | "inline" }.`;
  }

  return `Transcribe fielmente todo el texto técnico, encabezados, tablas Markdown y fórmulas matemáticas de esta imagen (página ${pageNumber} de ${totalPages} del PDF "${fileName}").
${qualityInstruction}
Reglas obligatorias:
1. Devuelve únicamente el contenido de esta página en Markdown limpio sin comentarios introductorios ni encabezados "## PÁGINA".
2. ${latexInstruction}
3. Preserva fielmente nombres de materiales, normas, tablas y valores numéricos.`;
}

function parseOcrResponsePayload(rawText: string): SinglePageOcrResult {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return { markdown: '', formulas: [] };

  // Try direct JSON or fenced ```json ... ```
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonCandidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  if (jsonCandidate.startsWith('{') && jsonCandidate.endsWith('}')) {
    try {
      const parsed = JSON.parse(jsonCandidate);
      if (parsed && typeof parsed.markdown === 'string') {
        return {
          markdown: parsed.markdown.replace(/^##\s+P[ÁA]GINA\s+\d+\s*/i, '').trim(),
          formulas: Array.isArray(parsed.formulas) ? parsed.formulas : [],
        };
      }
    } catch {
      // Fall back below
    }
  }

  // Handle nemotron-parse markdown_bbox JSON array payloads
  if (jsonCandidate.startsWith('[') && jsonCandidate.endsWith(']')) {
    try {
      const blocks = JSON.parse(jsonCandidate);
      if (Array.isArray(blocks)) {
        const parts: string[] = [];
        const formulas: Array<{ raw?: string; latex?: string; displayMode?: string }> = [];
        for (const item of blocks) {
          const itemText = typeof item?.text === 'string' ? item.text.trim() : '';
          if (!itemText) continue;
          parts.push(itemText);
          if (
            String(item?.type || '').toLowerCase().includes('formula') ||
            /\$\$[\s\S]+?\$\$/.test(itemText)
          ) {
            formulas.push({
              raw: itemText,
              latex: itemText.replace(/^\$\$|\$\$$/g, '').replace(/^\$|\$$/g, '').trim(),
              displayMode: 'block',
            });
          }
        }
        if (parts.length > 0) {
          return {
            markdown: parts.join('\n\n').replace(/^##\s+P[ÁA]GINA\s+\d+\s*/i, '').trim(),
            formulas,
          };
        }
      }
    } catch {
      // Fall back to plain markdown below
    }
  }

  return {
    markdown: trimmed.replace(/^##\s+P[ÁA]GINA\s+\d+\s*/i, '').trim(),
    formulas: [],
  };
}

async function ocrSinglePageWithGemini(
  modelId: string,
  imageBase64: string,
  mimeType: 'image/png' | 'application/pdf',
  fileName: string,
  pageNumber: number,
  totalPages: number,
  runtime: ReturnType<typeof getRuntimeSettings>,
  onRateWait?: (waitMs: number, limit: number) => void
): Promise<SinglePageOcrResult> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY no configurado en entorno.');
  }

  let targetModel = (modelId || 'gemini-2.5-flash').replace(/^models\//, '');
  if (targetModel === 'nano-banana') {
    targetModel = 'gemini-2.5-flash';
  }

  const timeoutMs = Math.max(10_000, (runtime.ocrTimeoutSeconds || 45) * 1000);
  const promptText = buildPageOcrPrompt(
    fileName,
    pageNumber,
    totalPages,
    runtime.ocrStrictLatex,
    runtime.ocrQuality,
    true,
    mimeType === 'application/pdf'
  );

  const callGemini = async (useStructuredSchema: boolean) => {
    await ocrRateLimiter.acquireSlot('google', onRateWait);

    const requestParams: any = {
      model: targetModel,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          { text: promptText },
        ],
      },
    };

    if (useStructuredSchema) {
      requestParams.config = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            markdown: {
              type: Type.STRING,
              description: 'Contenido completo de la página en Markdown limpio con fórmulas en LaTeX.',
            },
            formulas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  raw: { type: Type.STRING },
                  latex: { type: Type.STRING },
                  displayMode: { type: Type.STRING },
                },
              },
            },
          },
          required: ['markdown', 'formulas'],
        },
      };
    }

    const response = await Promise.race([
      ai.models.generateContent(requestParams),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(`Timeout (${runtime.ocrTimeoutSeconds}s) en OCR Gemini (${targetModel}) pág. ${pageNumber}`)
            ),
          timeoutMs
        )
      ),
    ]);

    return response.text?.trim() || '';
  };

  let lastErr: any;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await callGemini(attempt === 1);
      const parsed = parseOcrResponsePayload(raw);
      if (parsed.markdown) return parsed;
    } catch (err: any) {
      lastErr = err;
      const msg = err?.message || '';
      if (attempt === 1 && (msg.includes('429') || msg.includes('503') || msg.includes('400'))) {
        await new Promise((r) => setTimeout(r, msg.includes('429') ? 4000 : 1200));
        continue;
      }
      throw err;
    }
  }

  throw lastErr || new Error(`Gemini OCR (${targetModel}) devolvió respuesta vacía en pág. ${pageNumber}`);
}

async function ocrSinglePageWithNvidia(
  modelId: string,
  pngBase64: string,
  fileName: string,
  pageNumber: number,
  totalPages: number,
  runtime: ReturnType<typeof getRuntimeSettings>,
  onRateWait?: (waitMs: number, limit: number) => void
): Promise<SinglePageOcrResult> {
  const apiKey = process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_NIM_API_KEY no configurado en entorno.');
  }

  const timeoutMs = Math.max(10_000, (runtime.ocrTimeoutSeconds || 45) * 1000);
  const isNemotronParse = modelId.toLowerCase().includes('nemotron-parse');

  const executeCall = async (): Promise<SinglePageOcrResult> => {
    await ocrRateLimiter.acquireSlot('nvidia', onRateWait);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (isNemotronParse) {
        const res = await fetch('https://ai.api.nvidia.com/v1/cv/nvidia/nemotron-parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': 'aistudio-build',
          },
          body: JSON.stringify({
            input: [
              {
                type: 'image_url',
                url: `data:image/png;base64,${pngBase64}`,
              },
            ],
            tools: [{ type: 'function', function: { name: 'markdown_bbox' } }],
          }),
          signal: controller.signal,
        });

        const raw = await res.text();
        if (!res.ok) {
          throw new Error(`NVIDIA nemotron-parse (${res.status}): ${raw.slice(0, 260)}`);
        }
        const data = JSON.parse(raw);
        const textOut =
          data?.choices?.[0]?.message?.content ||
          data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ||
          raw;
        return parseOcrResponsePayload(typeof textOut === 'string' ? textOut : JSON.stringify(textOut));
      }

      const promptText = buildPageOcrPrompt(
        fileName,
        pageNumber,
        totalPages,
        runtime.ocrStrictLatex,
        runtime.ocrQuality,
        false
      );

      const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'aistudio-build',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: promptText },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/png;base64,${pngBase64}` },
                },
              ],
            },
          ],
          max_tokens: 4096,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      const raw = await res.text();
      if (!res.ok) {
        let detail = raw;
        try {
          const parsed = JSON.parse(raw);
          detail = parsed?.detail || parsed?.message || parsed?.error?.message || raw;
        } catch {}
        throw new Error(`Error en NVIDIA NIM OCR (${res.status}): ${detail.slice(0, 280)}`);
      }

      const data = JSON.parse(raw);
      const content = data?.choices?.[0]?.message?.content || '';
      return parseOcrResponsePayload(content);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error(`Timeout (${runtime.ocrTimeoutSeconds}s) en OCR NVIDIA (${modelId}) pág. ${pageNumber}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await executeCall();
      if (result.markdown) return result;
    } catch (err: any) {
      const msg = err?.message || '';
      if (attempt === 1 && (msg.includes('429') || msg.includes('503'))) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw err;
    }
  }

  throw new Error(`NVIDIA OCR (${modelId}) devolvió respuesta vacía en pág. ${pageNumber}`);
}

// ============================================================================
// CHUNKING ENGINE (Honoring semantic, recursive, sliding, pages)
// ============================================================================
interface BuiltChunk {
  chunkIndex: number;
  pageNumber: number;
  sectionTitle: string;
  tokenCount: number;
  vector: number[];
  textExcerpt: string;
}

function buildDocumentChunks(
  extractedMarkdown: string,
  chunkSize: number,
  chunkOverlap: number,
  chunkStrategy: string
): BuiltChunk[] {
  const wordsPerTokenRatio = 0.75;
  const maxWordsPerChunk = Math.max(80, Math.round(chunkSize * wordsPerTokenRatio));
  const overlapWords = Math.min(Math.floor(maxWordsPerChunk * 0.5), Math.round(chunkOverlap * wordsPerTokenRatio));
  const step = Math.max(40, maxWordsPerChunk - overlapWords);

  const rawPages = extractedMarkdown
    .split(/(?=^##\s+P[ÁA]GINA\s+\d+)/im)
    .filter((s) => s.trim().length > 0);

  const sampleChunks: BuiltChunk[] = [];
  let chunkCounter = 0;

  const pushChunk = (pageNumber: number, sectionTitle: string, textBody: string) => {
    const cleanBody = textBody.trim();
    if (!cleanBody) return;
    chunkCounter++;
    const wordLen = cleanBody.split(/\s+/).filter(Boolean).length;
    sampleChunks.push({
      chunkIndex: chunkCounter,
      pageNumber,
      sectionTitle,
      tokenCount: Math.max(12, Math.round(wordLen * 1.3)),
      vector: Array.from({ length: 8 }, (_, k) =>
        Number((Math.sin(chunkCounter * 1.7 + k) * 0.8).toFixed(4))
      ),
      textExcerpt: cleanBody.slice(0, 360).replace(/\s+/g, ' ').trim(),
    });
  };

  for (const pageSec of rawPages) {
    const pageMatch = pageSec.match(/^##\s+P[ÁA]GINA\s+(\d+)/im);
    const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : 1;
    const lines = pageSec.split('\n');
    const firstHeading =
      lines.find((l) => l.trim().length > 0)?.replace(/^#+\s*/, '') || `Página ${pageNumber}`;

    if (chunkStrategy === 'pages') {
      const words = pageSec.split(/\s+/).filter(Boolean);
      if (words.length <= maxWordsPerChunk * 1.5) {
        pushChunk(pageNumber, firstHeading, pageSec);
      } else {
        for (let start = 0; start < words.length; start += step) {
          pushChunk(
            pageNumber,
            `${firstHeading} (Parte ${Math.floor(start / step) + 1})`,
            words.slice(start, start + maxWordsPerChunk).join(' ')
          );
          if (start + maxWordsPerChunk >= words.length) break;
        }
      }
      continue;
    }

    if (chunkStrategy === 'semantic') {
      const subSections = pageSec.split(/\n(?=###?\s+)/).filter((s) => s.trim().length > 0);
      for (const sub of subSections) {
        const subHeading =
          sub.split('\n')[0]?.replace(/^#+\s*/, '').trim() || firstHeading;
        const words = sub.split(/\s+/).filter(Boolean);
        if (words.length <= maxWordsPerChunk) {
          pushChunk(pageNumber, subHeading, sub);
        } else {
          for (let start = 0; start < words.length; start += step) {
            pushChunk(
              pageNumber,
              `${subHeading} (Parte ${Math.floor(start / step) + 1})`,
              words.slice(start, start + maxWordsPerChunk).join(' ')
            );
            if (start + maxWordsPerChunk >= words.length) break;
          }
        }
      }
      continue;
    }

    if (chunkStrategy === 'recursive') {
      const paragraphs = pageSec.split(/\n\n+/).filter((p) => p.trim().length > 0);
      let buffer = '';
      let part = 1;
      for (const para of paragraphs) {
        const combined = buffer ? `${buffer}\n\n${para}` : para;
        const wordsCount = combined.split(/\s+/).filter(Boolean).length;
        if (wordsCount <= maxWordsPerChunk) {
          buffer = combined;
        } else {
          if (buffer) {
            pushChunk(pageNumber, `${firstHeading} (Bloque ${part++})`, buffer);
          }
          const paraWords = para.split(/\s+/).filter(Boolean);
          if (paraWords.length <= maxWordsPerChunk) {
            buffer = para;
          } else {
            for (let start = 0; start < paraWords.length; start += step) {
              pushChunk(
                pageNumber,
                `${firstHeading} (Bloque ${part++})`,
                paraWords.slice(start, start + maxWordsPerChunk).join(' ')
              );
              if (start + maxWordsPerChunk >= paraWords.length) break;
            }
            buffer = '';
          }
        }
      }
      if (buffer) {
        pushChunk(pageNumber, part > 1 ? `${firstHeading} (Bloque ${part})` : firstHeading, buffer);
      }
      continue;
    }

    // 'sliding' or default
    const words = pageSec.split(/\s+/).filter(Boolean);
    if (words.length <= maxWordsPerChunk) {
      pushChunk(pageNumber, firstHeading, pageSec);
    } else {
      for (let start = 0; start < words.length; start += step) {
        pushChunk(
          pageNumber,
          `${firstHeading} (Ventana ${Math.floor(start / step) + 1})`,
          words.slice(start, start + maxWordsPerChunk).join(' ')
        );
        if (start + maxWordsPerChunk >= words.length) break;
      }
    }
  }

  return sampleChunks;
}

// ============================================================================
// MAIN EXTRACTION ORCHESTRATOR (Python -> Triage -> Rate-Limited OCR -> LaTeX/JSON)
// ============================================================================
export async function extractPdfToLibraryFiles(
  pdfBuffer: Buffer,
  discipline: string,
  fileName: string,
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
    chunkStrategy?: string;
    useGeminiFallback?: boolean;
    pdfPathOnDisk?: string;
    job?: ExtractionJob;
  } = {}
): Promise<{
  totalPages: number;
  extractedMarkdown: string;
  chunksCount: number;
  sampleChunks: BuiltChunk[];
  formulas: ReconstructedFormula[];
  pagesDetail: PageExtractionDetail[];
  engine: string;
}> {
  const chunkSize = options.chunkSize || 512;
  const chunkOverlap = options.chunkOverlap || 64;
  const chunkStrategy = options.chunkStrategy || 'semantic';
  const cleanTitle = fileName.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
  const runtime = getRuntimeSettings();
  const job = options.job;

  const targetPdfDir = path.join(ROOT_LIBRARY_DIR, discipline, 'pdf');
  const finalPdfPath = options.pdfPathOnDisk || path.join(targetPdfDir, fileName);
  if (!fs.existsSync(targetPdfDir)) fs.mkdirSync(targetPdfDir, { recursive: true });
  if (!fs.existsSync(finalPdfPath)) {
    fs.writeFileSync(finalPdfPath, pdfBuffer);
  }

  const ocrDpi = runtime.ocrQuality === 'high' ? 250 : runtime.ocrQuality === 'fast' ? 120 : 180;
  const ocrModelId = (runtime.visionOcrModel || 'gemini-2.5-flash').replace(/^models\//, '');
  const ocrProvider = resolveOcrProvider(ocrModelId);
  const rateLimitPerMin = ocrRateLimiter.getLimit(ocrProvider);

  // --------------------------------------------------------------------------
  // STEP 2: Start extraction with Python
  // --------------------------------------------------------------------------
  if (job) {
    job.status = 'triaging';
    job.progress = 18;
    job.stageMessage = '2/5: Iniciando extracción de texto por página con Python...';
  }

  const pythonResult = await runPythonPdfExtractor(finalPdfPath, ocrDpi);
  let extractionEngine = pythonResult?.engine || 'node-unpdf-fallback';
  let totalPages = pythonResult?.totalPages || 1;
  let pdfTitle = pythonResult?.metadata?.title || '';
  let pdfAuthor = pythonResult?.metadata?.author || '';

  interface WorkingPage {
    pageNumber: number;
    text: string;
    imageCount: number;
    isScanned: boolean;
    needsNodeTextCheck: boolean;
    source: 'python_native' | 'ocr_vision' | 'empty';
    ocrNote?: string;
    ocrFormulas: Array<{ raw?: string; latex?: string; displayMode?: string }>;
  }

  let workingPages: WorkingPage[] = [];

  if (pythonResult && pythonResult.pages.length > 0) {
    workingPages = pythonResult.pages.map((p) => {
      const cls = classifyPageContent(p.text, { imageCount: p.imageCount });
      // Requirement 3: If page extracted with real content, NEVER classify as scanned
      const isScanned = cls.isScanned;
      return {
        pageNumber: p.pageNumber,
        text: p.text,
        imageCount: p.imageCount,
        isScanned,
        needsNodeTextCheck: isScanned && p.needsNodeTextCheck,
        source: isScanned ? 'empty' : 'python_native',
        ocrFormulas: [],
      };
    });
  }

  // If Python stdlib lacked fitz/pypdf and flagged CID/Type0 pages, or Python wasn't installed,
  // verify native embedded text via unpdf (PDF.js CMap decoder) before classifying as scanned.
  const shouldVerifyWithUnpdf =
    workingPages.length === 0 || workingPages.some((p) => p.needsNodeTextCheck);

  if (shouldVerifyWithUnpdf) {
    try {
      const { extractText, inspectPages, getMeta } = await import('unpdf');
      const dataCopy = new Uint8Array(pdfBuffer);
      const [extracted, inspected, meta] = await Promise.all([
        extractText(dataCopy, { mergePages: false }),
        inspectPages(new Uint8Array(pdfBuffer)).catch(() => null),
        getMeta(new Uint8Array(pdfBuffer)).catch(() => null),
      ]);

      if (!pdfTitle && meta?.info?.Title) pdfTitle = String(meta.info.Title).trim();
      if (!pdfAuthor && meta?.info?.Author) pdfAuthor = String(meta.info.Author).trim();

      const unpdfTexts = Array.isArray(extracted.text)
        ? extracted.text
        : [String(extracted.text || '')];
      totalPages = extracted.totalPages || unpdfTexts.length || totalPages;

      if (workingPages.length === 0) {
        workingPages = unpdfTexts.map((rawTxt, idx) => {
          const pageInsp = inspected?.pages?.[idx];
          const cls = classifyPageContent(rawTxt, {
            imageCount: pageInsp?.imageCount ?? 0,
          });
          return {
            pageNumber: idx + 1,
            text: rawTxt,
            imageCount: pageInsp?.imageCount ?? 0,
            isScanned: cls.isScanned,
            needsNodeTextCheck: false,
            source: cls.isScanned ? 'empty' : 'python_native',
            ocrFormulas: [],
          };
        });
      } else {
        extractionEngine = `${extractionEngine}+pdfjs-cmap`;
        for (const wp of workingPages) {
          if (!wp.needsNodeTextCheck) continue;
          const candidateText = unpdfTexts[wp.pageNumber - 1] || '';
          const pageInsp = inspected?.pages?.[wp.pageNumber - 1];
          const cls = classifyPageContent(candidateText, {
            imageCount: pageInsp?.imageCount ?? wp.imageCount,
          });
          if (!cls.isScanned) {
            wp.text = candidateText;
            wp.isScanned = false;
            wp.source = 'python_native';
          }
          wp.needsNodeTextCheck = false;
        }
      }
    } catch (unpdfErr: any) {
      console.warn(`[PDF Extraction] unpdf verification skipped for ${fileName}:`, unpdfErr?.message || unpdfErr);
      if (workingPages.length === 0) {
        workingPages = [
          {
            pageNumber: 1,
            text: '',
            imageCount: 1,
            isScanned: true,
            needsNodeTextCheck: false,
            source: 'empty',
            ocrFormulas: [],
          },
        ];
      }
    }
  }

  // --------------------------------------------------------------------------
  // STEP 3 & 4: Per-Page Triage & Fallback OCR on Scanned Pages ONLY
  // --------------------------------------------------------------------------
  const nativePages = workingPages.filter((p) => !p.isScanned);
  const scannedPages = workingPages.filter((p) => p.isScanned);

  if (job) {
    job.totalPages = totalPages;
    job.nativePagesCount = nativePages.length;
    job.scannedPagesCount = scannedPages.length;
    job.ocrProcessedCount = 0;
    job.extractionEngine = extractionEngine;
    job.rateLimitPolicy = `${ocrProvider === 'nvidia' ? 'NVIDIA NIM' : 'Gemini'}: máx. ${rateLimitPerMin} págs/min`;
    job.progress = 35;
    job.stageMessage =
      scannedPages.length === 0
        ? `3/5: Python extrajo ${nativePages.length}/${totalPages} páginas nativas (0 escaneadas).`
        : `3/5: Triage listo — ${nativePages.length} págs nativas, ${scannedPages.length} págs escaneadas para OCR (${ocrModelId}).`;
  }

  const maxOcrBytes = Math.max(1, runtime.ocrMaxFileSizeMb || 18) * 1024 * 1024;
  const maxOcrPages = runtime.ocrMaxPagesPerDoc > 0 ? runtime.ocrMaxPagesPerDoc : 0;
  const canRunOcr =
    options.useGeminiFallback !== false &&
    runtime.visionOcrEnabled &&
    pdfBuffer.length <= maxOcrBytes;

  if (scannedPages.length > 0 && canRunOcr) {
    const pagesToOcr = maxOcrPages > 0 ? scannedPages.slice(0, maxOcrPages) : scannedPages;
    const skippedByLimit = maxOcrPages > 0 ? scannedPages.slice(maxOcrPages) : [];

    for (const sk of skippedByLimit) {
      sk.ocrNote = `[Página ${sk.pageNumber} clasificada como escaneada; omitida por límite OCR de ${maxOcrPages} páginas en Ajustes]`;
    }

    const tempRenderDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-rag-ocr-'));
    try {
      const renderedImages = await renderScannedPagesWithPython(
        finalPdfPath,
        pagesToOcr.map((p) => p.pageNumber),
        tempRenderDir,
        ocrDpi
      );

      let ocrDone = 0;
      for (const sp of pagesToOcr) {
        if (job) {
          job.status = 'ocr_extracting';
          job.currentPage = sp.pageNumber;
          job.progress = Math.min(78, 38 + Math.round((ocrDone / Math.max(1, pagesToOcr.length)) * 40));
          job.stageMessage = `3/5: OCR Visión (${ocrModelId}, máx. ${rateLimitPerMin}/min) — página ${sp.pageNumber}/${totalPages} (${ocrDone + 1}/${pagesToOcr.length} escaneadas)...`;
        }

        const pngPath = renderedImages[sp.pageNumber];
        const onWait = (waitMs: number, limit: number) => {
          if (job) {
            const secs = Math.ceil(waitMs / 1000);
            job.stageMessage = `3/5: Límite ${ocrProvider === 'nvidia' ? 'NVIDIA' : 'Gemini'} (${limit} págs/min) — esperando ${secs}s para página ${sp.pageNumber}...`;
          }
        };

        try {
          if (ocrProvider === 'nvidia') {
            if (!pngPath || !fs.existsSync(pngPath)) {
              sp.ocrNote = `[Página ${sp.pageNumber} escaneada: no se pudo rasterizar a PNG para OCR NVIDIA (${ocrModelId})]`;
              continue;
            }
            const pngBase64 = fs.readFileSync(pngPath).toString('base64');
            const ocrRes = await ocrSinglePageWithNvidia(
              ocrModelId,
              pngBase64,
              fileName,
              sp.pageNumber,
              totalPages,
              runtime,
              onWait
            );
            sp.text = ocrRes.markdown;
            sp.ocrFormulas = ocrRes.formulas;
            sp.source = 'ocr_vision';
          } else {
            // Gemini Vision OCR: prefer rendered PNG of the single page; fall back to full PDF only if small & no PNG
            let mediaBase64: string;
            let mediaMime: 'image/png' | 'application/pdf';
            if (pngPath && fs.existsSync(pngPath)) {
              mediaBase64 = fs.readFileSync(pngPath).toString('base64');
              mediaMime = 'image/png';
            } else {
              mediaBase64 = pdfBuffer.toString('base64');
              mediaMime = 'application/pdf';
            }

            const ocrRes = await ocrSinglePageWithGemini(
              ocrModelId,
              mediaBase64,
              mediaMime,
              fileName,
              sp.pageNumber,
              totalPages,
              runtime,
              onWait
            );
            sp.text = ocrRes.markdown;
            sp.ocrFormulas = ocrRes.formulas;
            sp.source = 'ocr_vision';
          }
          ocrDone++;
          if (job) {
            job.ocrProcessedCount = ocrDone;
          }
        } catch (pageErr: any) {
          const reason = pageErr?.message || 'Error en llamada OCR';
          console.warn(`[OCR Page ${sp.pageNumber}] ${fileName} (${ocrModelId}):`, reason);
          sp.ocrNote = `[Página ${sp.pageNumber} escaneada: error en fallback OCR (${ocrModelId}): ${reason}]`;
        }
      }
    } finally {
      try {
        fs.rmSync(tempRenderDir, { recursive: true, force: true });
      } catch {}
    }
  } else if (scannedPages.length > 0) {
    const reason = !runtime.visionOcrEnabled
      ? 'OCR por Visión desactivado en Ajustes.'
      : pdfBuffer.length > maxOcrBytes
        ? `El archivo (${(pdfBuffer.length / (1024 * 1024)).toFixed(1)} MB) supera el límite OCR (${runtime.ocrMaxFileSizeMb} MB).`
        : 'Fallback OCR omitido por configuración.';
    for (const sp of scannedPages) {
      sp.ocrNote = `[Página ${sp.pageNumber} escaneada — ${reason}]`;
    }
  }

  // --------------------------------------------------------------------------
  // STEP 5 & 6: Reconstruct Formulas (LaTeX + JSON) and Persist Files
  // --------------------------------------------------------------------------
  if (job) {
    job.status = 'latex_parsing';
    job.progress = 82;
    job.stageMessage = '4/5: Reconstruyendo fórmulas matemáticas en LaTeX y JSON...';
  }

  const allFormulas: ReconstructedFormula[] = [];
  const pagesDetail: PageExtractionDetail[] = [];

  const renderedPagesMarkdown = workingPages.map((wp) => {
    const cleanedRaw = (wp.text || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    let pageBody = cleanedRaw;
    if (pageBody) {
      pageBody = normalizeFormulasToLatex(pageBody);
    } else {
      pageBody = wp.ocrNote || '[Página sin contenido textual extraíble]';
    }

    const formulaSource: 'python_native' | 'ocr_vision' =
      wp.source === 'ocr_vision' ? 'ocr_vision' : 'python_native';
    const pageFormulas = extractFormulasAsJson(
      pageBody,
      wp.pageNumber,
      formulaSource,
      wp.ocrFormulas
    );
    allFormulas.push(...pageFormulas);

    const cls = classifyPageContent(cleanedRaw, { imageCount: wp.imageCount });
    pagesDetail.push({
      pageNumber: wp.pageNumber,
      source: wp.source,
      isScanned: wp.isScanned,
      charCount: cls.charCount,
      alnumCount: cls.alnumCount,
      wordCount: cls.wordCount,
      formulasCount: pageFormulas.length,
      ...(wp.source === 'ocr_vision' ? { ocrModel: ocrModelId, ocrProvider } : {}),
      ...(wp.ocrNote ? { note: wp.ocrNote } : {}),
    });

    return `## PÁGINA ${wp.pageNumber}\n${pageBody}`;
  });

  const bodyMarkdown = renderedPagesMarkdown.join('\n\n---\n\n');
  const displayTitle = pdfTitle || cleanTitle;

  const extractedMarkdown = `# ${displayTitle.toUpperCase()}
**Disciplina:** ${discipline.replace(/_/g, ' ')}
**Archivo Original:** ${fileName}
**Páginas Totales:** ${totalPages}
**Motor de Extracción:** ${extractionEngine} (Nativas: ${nativePages.length} | OCR Escaneadas: ${pagesDetail.filter((p) => p.source === 'ocr_vision').length})
**Fórmulas Reconstruidas:** ${allFormulas.length} (LaTeX + JSON)
**Fecha de Indexación:** ${new Date().toLocaleDateString()}

---

${bodyMarkdown}
`;

  // Save extracted Markdown/LaTeX text into: .../libreria/[Disciplina]/txt/
  const targetTxtDir = path.join(ROOT_LIBRARY_DIR, discipline, 'txt');
  const finalTxtPath = path.join(targetTxtDir, fileName.replace(/\.pdf$/i, '.txt'));
  if (!fs.existsSync(targetTxtDir)) fs.mkdirSync(targetTxtDir, { recursive: true });
  fs.writeFileSync(finalTxtPath, extractedMarkdown, 'utf-8');

  // Build chunks according to active strategy
  const sampleChunks = buildDocumentChunks(extractedMarkdown, chunkSize, chunkOverlap, chunkStrategy);

  const targetVectorDir = path.join(ROOT_LIBRARY_DIR, discipline, 'vector');
  const finalVectorPath = path.join(targetVectorDir, fileName.replace(/\.pdf$/i, '_vectors.json'));
  if (!fs.existsSync(targetVectorDir)) fs.mkdirSync(targetVectorDir, { recursive: true });

  const chunksCount = Math.max(1, sampleChunks.length);
  const ocrProcessedCount = pagesDetail.filter((p) => p.source === 'ocr_vision').length;

  const vectorMetadata = {
    discipline,
    fileName,
    cleanTitle: displayTitle,
    pages: totalPages,
    author: pdfAuthor || 'Documento PDF Indexado',
    isExample: false,
    model: runtime.embeddingModel || 'text-embedding-004 (768-D)',
    chunkStrategy,
    chunkSize,
    chunkOverlap,
    chunksCount,
    extractedAt: new Date().toISOString(),
    extractionPipeline: {
      engine: extractionEngine,
      nativePages: nativePages.length,
      scannedPages: scannedPages.length,
      ocrPagesProcessed: ocrProcessedCount,
      ocrModel: scannedPages.length > 0 ? ocrModelId : null,
      ocrProvider: scannedPages.length > 0 ? ocrProvider : null,
      ocrRateLimitPerMin: scannedPages.length > 0 ? rateLimitPerMin : null,
      formulasCount: allFormulas.length,
      pagesDetail,
    },
    formulas: allFormulas,
    storagePaths: {
      pdf: finalPdfPath,
      txt: finalTxtPath,
      vector: finalVectorPath,
    },
    sampleChunks,
  };

  fs.writeFileSync(finalVectorPath, JSON.stringify(vectorMetadata, null, 2), 'utf-8');

  if (job) {
    job.formulasCount = allFormulas.length;
    job.ocrProcessedCount = ocrProcessedCount;
  }

  return {
    totalPages,
    extractedMarkdown,
    chunksCount,
    sampleChunks,
    formulas: allFormulas,
    pagesDetail,
    engine: extractionEngine,
  };
}

/**
 * Execute the complete F1 Extraction Pipeline for a newly uploaded book
 */
export async function runBookExtractionPipeline(
  jobId: string,
  discipline: string,
  fileName: string,
  originalTempPath: string,
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
    chunkStrategy?: string;
    useGeminiFallback?: boolean;
  } = {}
): Promise<ExtractionJob> {
  ensureLibraryDirectories();

  const job: ExtractionJob = {
    id: jobId,
    discipline,
    fileName,
    originalFilePath: originalTempPath,
    totalPages: 1,
    currentPage: 0,
    status: 'triaging',
    progress: 10,
    stageMessage: '1/5: Guardando PDF original e iniciando extracción con Python...',
    extractedMarkdown: '',
    chunksCount: 0,
  };

  activeExtractionJobs.set(jobId, job);

  try {
    // 1. Copy original PDF intact into: .../libreria/[Disciplina]/pdf/
    const targetPdfDir = path.join(ROOT_LIBRARY_DIR, discipline, 'pdf');
    const finalPdfPath = path.join(targetPdfDir, fileName);
    if (!fs.existsSync(targetPdfDir)) fs.mkdirSync(targetPdfDir, { recursive: true });

    if (!originalTempPath || !fs.existsSync(originalTempPath)) {
      throw new Error('No se recibió el archivo PDF temporal en el servidor.');
    }

    fs.copyFileSync(originalTempPath, finalPdfPath);
    const pdfBuffer = fs.readFileSync(finalPdfPath);

    // 2. Execute Python-first per-page extraction + triage + rate-limited OCR fallback + LaTeX/JSON formulas
    const result = await extractPdfToLibraryFiles(pdfBuffer, discipline, fileName, {
      ...options,
      pdfPathOnDisk: finalPdfPath,
      job,
    });

    job.totalPages = result.totalPages;
    job.currentPage = result.totalPages;
    job.extractedMarkdown = result.extractedMarkdown;
    job.chunksCount = result.chunksCount;
    job.formulasCount = result.formulas.length;

    job.progress = 92;
    job.status = 'vectorizing';
    job.stageMessage = `5/5: Guardando ${result.chunksCount} chunks y ${result.formulas.length} fórmulas (LaTeX/JSON)...`;

    // 3. Completion
    job.progress = 100;
    job.status = 'completed';
    const ocrUsedCount = result.pagesDetail.filter((p) => p.source === 'ocr_vision').length;
    job.stageMessage = `Completado: ${result.totalPages} págs (${result.totalPages - ocrUsedCount} nativas, ${ocrUsedCount} OCR), ${result.formulas.length} fórmulas, ${result.chunksCount} chunks.`;
  } catch (error: any) {
    console.error('Error en pipeline de extracción:', error);
    job.status = 'error';
    job.error = error.message || 'Error desconocido durante la extracción';
  } finally {
    if (originalTempPath && fs.existsSync(originalTempPath)) {
      try {
        fs.unlinkSync(originalTempPath);
      } catch {}
    }
  }

  return job;
}

const LEGACY_DUMMY_SIGNATURES = [
  'En los sistemas mecánicos analizados en esta obra, el equilibrio estático y dinámico se rige',
  'Versión 100% Real (Python Local + LaTeX OCR)',
  'SÍNTESIS ALPHA RAG',
];

/**
 * Scan physical library on startup and repair any real uploaded PDFs whose .txt
 * still contains the old placeholder template or is missing extracted files.
 */
export async function repairOutdatedLibraryExtractions(): Promise<number> {
  ensureLibraryDirectories();
  let repairedCount = 0;

  const disciplines = fs.readdirSync(ROOT_LIBRARY_DIR);
  for (const disc of disciplines) {
    const discDir = path.join(ROOT_LIBRARY_DIR, disc);
    if (!fs.statSync(discDir).isDirectory()) continue;

    const pdfDir = path.join(discDir, 'pdf');
    if (!fs.existsSync(pdfDir)) continue;

    const pdfFiles = fs.readdirSync(pdfDir).filter((f) => f.toLowerCase().endsWith('.pdf'));
    for (const file of pdfFiles) {
      const pdfPath = path.join(pdfDir, file);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(pdfPath);
      } catch {
        continue;
      }

      if (SEED_BOOK_FILENAMES.has(file) && stat.size < 2048) {
        continue;
      }

      const baseName = file.replace(/\.pdf$/i, '');
      const txtPath = path.join(discDir, 'txt', `${baseName}.txt`);
      const vectorPath = path.join(discDir, 'vector', `${baseName}_vectors.json`);

      let needsRepair = !fs.existsSync(txtPath) || !fs.existsSync(vectorPath);
      if (!needsRepair) {
        try {
          const txtContent = fs.readFileSync(txtPath, 'utf-8');
          if (LEGACY_DUMMY_SIGNATURES.some((sig) => txtContent.includes(sig))) {
            needsRepair = true;
          }
        } catch {
          needsRepair = true;
        }
      }

      if (needsRepair) {
        try {
          const pdfBuffer = fs.readFileSync(pdfPath);
          await extractPdfToLibraryFiles(pdfBuffer, disc, file, {
            useGeminiFallback: true,
            pdfPathOnDisk: pdfPath,
          });
          repairedCount++;
          console.log(`[Library Repair] Texto y vectores reales re-extraídos para: ${disc}/${file}`);
        } catch (err: any) {
          console.warn(`[Library Repair] Error re-extrayendo ${disc}/${file}:`, err?.message || err);
        }
      }
    }
  }

  return repairedCount;
}

/**
 * Re-index all real PDFs in /libreria with updated chunking parameters
 */
export async function reindexPhysicalLibrary(
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
    chunkStrategy?: string;
  } = {}
): Promise<{ reindexedCount: number; books: LibraryBookFile[] }> {
  ensureLibraryDirectories();
  let reindexedCount = 0;

  const disciplines = fs.readdirSync(ROOT_LIBRARY_DIR);
  for (const disc of disciplines) {
    const discDir = path.join(ROOT_LIBRARY_DIR, disc);
    if (!fs.statSync(discDir).isDirectory()) continue;

    const pdfDir = path.join(discDir, 'pdf');
    if (!fs.existsSync(pdfDir)) continue;

    const pdfFiles = fs.readdirSync(pdfDir).filter((f) => f.toLowerCase().endsWith('.pdf'));
    for (const file of pdfFiles) {
      const pdfPath = path.join(pdfDir, file);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(pdfPath);
      } catch {
        continue;
      }

      if (SEED_BOOK_FILENAMES.has(file) && stat.size < 2048) {
        continue;
      }

      const pdfBuffer = fs.readFileSync(pdfPath);
      await extractPdfToLibraryFiles(pdfBuffer, disc, file, {
        chunkSize: options.chunkSize || 512,
        chunkOverlap: options.chunkOverlap || 64,
        chunkStrategy: options.chunkStrategy || 'semantic',
        useGeminiFallback: true,
        pdfPathOnDisk: pdfPath,
      });
      reindexedCount++;
    }
  }

  return {
    reindexedCount,
    books: getPhysicalLibraryTree(),
  };
}
