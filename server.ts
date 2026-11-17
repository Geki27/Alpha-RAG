import './src/server/env';
import express from 'express';
import compression from 'compression';
import http from 'http';
import os from 'os';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import {
  ensureLibraryDirectories,
  seedDefaultLibraryBooks,
  getPhysicalLibraryTree,
  deleteBookFromLibrary,
  ROOT_LIBRARY_DIR,
  DEFAULT_DISCIPLINES
} from './src/server/libraryStorage';
import {
  runBookExtractionPipeline,
  activeExtractionJobs,
  repairOutdatedLibraryExtractions,
  reindexPhysicalLibrary
} from './src/server/extractionEngine';
import { executeRagPipeline, executeWebRetrieval } from './src/server/ragPipeline';
import { detectAvailableModels } from './src/server/modelsDetector';
import { getPublicSettings, getRuntimeSettings, updateRuntimeSettings, resetRuntimeSettings } from './src/server/settingsStore';
import { AVAILABLE_MODELS } from './src/types/models';

function readCliArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  const eqPrefix = `${flag}=`;
  const eqArg = process.argv.find((a) => a.startsWith(eqPrefix));
  return eqArg ? eqArg.slice(eqPrefix.length) : undefined;
}

const app = express();
const PORT = Number(readCliArg('--port') || process.env.APP_PORT) || 3000;
const HOST = readCliArg('--host') || process.env.HOST || '0.0.0.0';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Disable server signature and enable fast gzip compression
app.disable('x-powered-by');
app.use(compression({ level: 6, threshold: 1024 }));

// Lightweight security headers compatible with local dev and embedded previews
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Prevent browser/proxy/ETag caching on dynamic API state (/api/settings, /api/library/books, etc.)
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Ensure physical folder structure & temp directory exist and seed default books
const TEMP_UPLOADS_DIR = path.resolve(process.cwd(), 'temp_uploads');
if (!fs.existsSync(TEMP_UPLOADS_DIR)) {
  fs.mkdirSync(TEMP_UPLOADS_DIR, { recursive: true });
}
ensureLibraryDirectories();
seedDefaultLibraryBooks();

function cleanupStaleTempUploads(maxAgeMs = 60 * 60 * 1000) {
  try {
    const now = Date.now();
    for (const entry of fs.readdirSync(TEMP_UPLOADS_DIR)) {
      const fullPath = path.join(TEMP_UPLOADS_DIR, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isFile() && now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(fullPath);
      }
    }
  } catch {
    // Non-fatal cleanup
  }
}
cleanupStaleTempUploads();

// ----------------------------------------------------
// HEALTHCHECK & RUNTIME DIAGNOSTICS
// ----------------------------------------------------
app.get('/api/health', (_req, res) => {
  const mem = process.memoryUsage();
  let libraryBooksCount = 0;
  try {
    libraryBooksCount = getPhysicalLibraryTree().length;
  } catch {
    libraryBooksCount = 0;
  }

  res.json({
    status: 'ok',
    mode: IS_PRODUCTION ? 'production' : 'development',
    port: PORT,
    uptimeSeconds: Math.round(process.uptime()),
    memoryMB: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024)
    },
    libraryBooksCount,
    providers: {
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      nvidiaConfigured: Boolean(process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY)
    },
    timestamp: new Date().toISOString()
  });
});

// ----------------------------------------------------
// API ROUTES: RAG RETRIEVAL PIPELINE (LOCAL, WEB, HYBRID)
// ----------------------------------------------------
app.post('/api/rag/query', async (req, res) => {
  try {
    const result = await executeRagPipeline(req.body);
    res.json(result);
  } catch (error: any) {
    console.error('Error en /api/rag/query:', error);
    res.status(500).json({ success: false, error: error.message || 'Error procesando consulta RAG' });
  }
});

// Dedicated Web Retrieval Test & Search Endpoint
app.post('/api/rag/web-search', async (req, res) => {
  try {
    const { query, topK, attachments } = req.body;
    const result = await executeWebRetrieval(query || '', topK || 5, attachments);
    res.json({
      success: true,
      query,
      count: result.chunks.length,
      chunks: result.chunks,
      webQueries: result.webQueries
    });
  } catch (error: any) {
    console.error('Error en /api/rag/web-search:', error);
    res.status(500).json({ success: false, error: error.message || 'Error en búsqueda web' });
  }
});

// List models and provider connectivity with auto-detection
app.get('/api/models', async (_req, res) => {
  try {
    const detection = await detectAvailableModels();
    res.json(detection);
  } catch (error: any) {
    console.error('Error autodetectando modelos:', error);
  res.json({
    success: true,
    models: AVAILABLE_MODELS,
    providers: {
      google: {
        active: true,
        authenticated: Boolean(process.env.GEMINI_API_KEY),
        label: 'Google AI Studio',
        status: 'Online (Catálogo Google AI)',
        detectedCount: 5
      },
      nvidia: {
        active: true,
        authenticated: Boolean(process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY),
        label: 'NVIDIA NIM Microservices',
        status: 'Online (Catálogo NVIDIA NIM)',
        detectedCount: 5
      }
    },
    totalDetected: AVAILABLE_MODELS.length
  });
  }
});

// ----------------------------------------------------
// API ROUTES: RUNTIME SETTINGS & PROVIDER CREDENTIALS
// ----------------------------------------------------
app.get('/api/settings', (_req, res) => {
  try {
    res.json({ success: true, ...getPublicSettings() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error leyendo configuración' });
  }
});

async function handleUpdateSettings(req: express.Request, res: express.Response) {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    body = body || {};
    const updated = updateRuntimeSettings(body);
    const shouldDetectModels = Boolean(body.apiKeys || body.detectModels);
    const detection = shouldDetectModels
      ? await detectAvailableModels().catch(() => null)
      : null;
    res.json({
      success: true,
      ...updated,
      detection
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error guardando configuración' });
  }
}

app.put('/api/settings', handleUpdateSettings);
app.post('/api/settings/sync', express.text({ type: ['text/plain', 'application/json'], limit: '1mb' }), handleUpdateSettings);

app.post('/api/settings/reset', (_req, res) => {
  try {
    res.json({ success: true, ...resetRuntimeSettings() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error restableciendo configuración' });
  }
});

// Configure multer for PDF uploads into temporary dir before pipeline processing
const upload = multer({
  dest: TEMP_UPLOADS_DIR,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// ----------------------------------------------------
// API ROUTES: F1 LIBRARY & EXTRACTION PIPELINE
// ----------------------------------------------------

// 1. List all disciplines and books from physical filesystem
app.get('/api/library/books', (_req, res) => {
  try {
    const books = getPhysicalLibraryTree();
    const { hideExamples } = getRuntimeSettings();
    res.json({ success: true, count: books.length, hideExamples, books });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function handleDeleteLibraryBook(discipline: string, filename: string, res: express.Response) {
  try {
    const { deleted, isSeed } = deleteBookFromLibrary(discipline, filename);
    if (isSeed) {
      const current = getRuntimeSettings();
      const nextDeleted = Array.from(new Set([...current.deletedSeedFiles, filename]));
      updateRuntimeSettings({ settings: { deletedSeedFiles: nextDeleted } });
    }
    const books = getPhysicalLibraryTree();
    res.json({ success: true, deleted, count: books.length, books });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error eliminando libro' });
  }
}

// 1b. Delete a book from disk and remember seed deletion across restarts
app.delete('/api/library/book/:discipline/:filename', (req, res) => {
  const { discipline, filename } = req.params;
  handleDeleteLibraryBook(discipline, filename, res);
});

app.post('/api/library/book/delete', (req, res) => {
  const discipline = String(req.body?.discipline || '');
  const filename = String(req.body?.fileName || req.body?.filename || '');
  if (!discipline || !filename) {
    return res.status(400).json({ success: false, error: 'Se requiere disciplina y nombre de archivo.' });
  }
  handleDeleteLibraryBook(discipline, filename, res);
});

// 1c. Restore default example books
app.post('/api/library/examples/restore', (_req, res) => {
  try {
    updateRuntimeSettings({ settings: { hideExamples: false, deletedSeedFiles: [] } });
    seedDefaultLibraryBooks(true);
    const books = getPhysicalLibraryTree();
    res.json({ success: true, hideExamples: false, count: books.length, books });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error restaurando ejemplos' });
  }
});

// 2. List disciplines
app.get('/api/library/disciplines', (_req, res) => {
  res.json({ success: true, disciplines: DEFAULT_DISCIPLINES });
});

// 3. Serve physical file from libreria/[discipline]/[pdf|txt|vector]/[filename]
app.get('/api/library/file/:discipline/:folder/:filename', (req, res) => {
  const { discipline, folder, filename } = req.params;

  if (!['pdf', 'txt', 'vector'].includes(folder)) {
    return res.status(400).json({ error: 'Carpeta no válida. Solo pdf, txt o vector.' });
  }

  const rootResolved = path.resolve(ROOT_LIBRARY_DIR);
  const filePath = path.resolve(rootResolved, discipline, folder, filename);

  // Prevent directory traversal outside ROOT_LIBRARY_DIR
  if (!filePath.startsWith(rootResolved + path.sep)) {
    return res.status(403).json({ error: 'Acceso denegado fuera del repositorio de biblioteca.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Archivo no encontrado en el almacenamiento local.' });
  }

  if (folder === 'txt') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  } else if (folder === 'vector') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  } else if (folder === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
  }

  res.sendFile(filePath);
});

// 4. Ingest and extract a new PDF book
app.post('/api/library/upload', upload.single('pdfFile'), async (req, res) => {
  try {
    const file = req.file;
    const discipline = req.body.discipline || 'Estatica';
    const originalName = req.body.originalName || file?.originalname || 'Libro_Ingenieria.pdf';
    const chunkSize = parseInt(req.body.chunkSize) || 512;
    const chunkOverlap = parseInt(req.body.chunkOverlap) || 64;
    const chunkStrategy = req.body.chunkStrategy || 'semantic';

    if (!file) {
      return res.status(400).json({ success: false, error: 'No se recibió ningún archivo PDF en la solicitud.' });
    }

    updateRuntimeSettings({
      settings: {
        uploadDiscipline: discipline,
        chunkSize,
        chunkOverlap,
        chunkStrategy: chunkStrategy as any,
      },
    });

    const tempFilePath = file.path;
    const jobId = `job-${Date.now()}`;

    const jobPromise = runBookExtractionPipeline(jobId, discipline, originalName, tempFilePath, {
      chunkSize,
      chunkOverlap,
      chunkStrategy,
      useGeminiFallback: true
    });

    res.json({
      success: true,
      jobId,
      message: 'Ingestión y extracción iniciada en pipeline F1 local.',
      discipline,
      fileName: originalName
    });

    await jobPromise.catch((err) => {
      console.error('[Library Upload Pipeline Error]:', err);
    });
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// 4b. Re-index real library PDFs with updated chunking parameters
app.post('/api/library/reindex', async (req, res) => {
  try {
    const chunkSize = parseInt(req.body?.chunkSize) || 512;
    const chunkOverlap = parseInt(req.body?.chunkOverlap) || 64;
    const chunkStrategy = req.body?.chunkStrategy || 'semantic';

    updateRuntimeSettings({
      settings: {
        chunkSize,
        chunkOverlap,
        chunkStrategy,
      },
    });

    const result = await reindexPhysicalLibrary({
      chunkSize,
      chunkOverlap,
      chunkStrategy
    });

    res.json({
      success: true,
      reindexedCount: result.reindexedCount,
      count: result.books.length,
      books: result.books
    });
  } catch (error: any) {
    console.error('Error en /api/library/reindex:', error);
    res.status(500).json({ success: false, error: error.message || 'Error re-indexando la biblioteca' });
  }
});

// 5. Track extraction job progress
app.get('/api/library/job/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = activeExtractionJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ success: false, error: 'Trabajo no encontrado' });
  }

  res.json({ success: true, job });
});

// Return explicit JSON 404 for unknown API endpoints instead of falling through to SPA HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint no encontrado: ${req.method} ${req.originalUrl}`
  });
});

// ----------------------------------------------------
// LOCAL & PRODUCTION SERVING (PORT 3000)
// ----------------------------------------------------
function getLocalNetworkUrls(port: number): string[] {
  const urls: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const ifaceList of Object.values(interfaces)) {
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family === 'IPv4' && !iface.internal) {
        urls.push(`http://${iface.address}:${port}`);
      }
    }
  }
  return urls;
}

async function startServer() {
  const server = http.createServer(app);
  // Generous timeouts for local RAG synthesis and large PDF uploads
  server.requestTimeout = 180_000;
  server.keepAliveTimeout = 61_000;
  server.headersTimeout = 65_000;

  if (!IS_PRODUCTION) {
    const disableHmr =
      process.env.DISABLE_HMR === 'true' || Boolean(process.env.CONTROL_PLANE_PORT);
    const vitePromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          hmr: disableHmr ? false : { server },
          ws: disableHmr ? false : undefined,
          watch: disableHmr ? null : undefined,
        },
      })
    );

    // Log Vite startup error if it occurs
    vitePromise.catch((err) => {
      console.error('[Alpha RAG Server] Error iniciando Vite middleware:', err);
    });

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(distPath)) {
      console.error('[Alpha RAG Server] Error: No se encontró la carpeta "dist/". Ejecuta "npm run build" antes de iniciar en modo producción.');
      process.exit(1);
    }

    const assetsPath = path.join(distPath, 'assets');
    if (fs.existsSync(assetsPath)) {
      app.use(
        '/assets',
        express.static(assetsPath, {
          maxAge: '1y',
          immutable: true,
          etag: true
        })
      );
    }

    app.use(
      express.static(distPath, {
        index: false,
        maxAge: '1h',
        etag: true
      })
    );

    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[Alpha RAG Server] El puerto ${PORT} ya está en uso en localhost.`);
      console.error(`  -> Cierra el proceso anterior o inicia en otro puerto: APP_PORT=${PORT + 1} npm run local\n`);
      process.exit(1);
    }
    throw err;
  });

  // Bind port immediately without blocking on PDF repair or Vite dep optimization
  server.listen(PORT, HOST, () => {
    setImmediate(() => {
      repairOutdatedLibraryExtractions()
        .then((repaired) => {
          if (repaired > 0) {
            console.log(`[Alpha RAG Server] Reparados ${repaired} documentos PDF en /libreria con extracción real.`);
          }
        })
        .catch((err) => {
          console.warn('[Alpha RAG Server] Error durante verificación inicial de /libreria:', err);
        });
    });
    const modeLabel = IS_PRODUCTION
      ? 'Production Optimized (dist/ + gzip + cache inmutable)'
      : 'Development (Vite Middleware)';
    const geminiReady = Boolean(process.env.GEMINI_API_KEY);
    const nvidiaReady = Boolean(process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY);
    const lanUrls = getLocalNetworkUrls(PORT);

    console.log('\n============================================================');
    console.log('  AetherVector RAG - Servidor Local Listo');
    console.log('============================================================');
    console.log(`  Modo       : ${modeLabel}`);
    console.log(`  Localhost  : http://localhost:${PORT}`);
    if (lanUrls.length > 0) {
      console.log(`  Red local  : ${lanUrls[0]}`);
    }
    console.log(`  Salud API  : http://localhost:${PORT}/api/health`);
    console.log(`  Biblioteca : ${ROOT_LIBRARY_DIR}`);
    console.log(`  Gemini API : ${geminiReady ? 'Configurada' : 'Pendiente (revisa .env)'}`);
    console.log(`  NVIDIA NIM : ${nvidiaReady ? 'Configurada' : 'Opcional (no definida)'}`);
    console.log('============================================================\n');
  });

  const shutdown = (signal: string) => {
    console.log(`\n[Alpha RAG Server] Recibida señal ${signal}. Cerrando servidor ordenadamente...`);
    server.close(() => {
      console.log('[Alpha RAG Server] Conexiones cerradas correctamente.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer();
