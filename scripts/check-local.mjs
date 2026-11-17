import fs from 'fs';
import path from 'path';
import net from 'net';

const rootDir = process.cwd();
const nodeMajor = Number(process.versions.node.split('.')[0]);

console.log('\n[Preflight Localhost] Verificando entorno de ejecución...');

if (Number.isNaN(nodeMajor) || nodeMajor < 20) {
  console.error(`❌ Se requiere Node.js >= 20.0.0 (detectado: v${process.versions.node}).`);
  process.exit(1);
}
console.log(`✔ Node.js v${process.versions.node}`);

if (!fs.existsSync(path.join(rootDir, 'node_modules'))) {
  console.error('❌ No se encontró "node_modules". Ejecuta "npm install" primero.');
  process.exit(1);
}
console.log('✔ Dependencias instaladas (node_modules)');

const envLocalPath = path.join(rootDir, '.env.local');
const envPath = path.join(rootDir, '.env');
const hasEnvFile = fs.existsSync(envLocalPath) || fs.existsSync(envPath);

let port = Number(process.env.APP_PORT) || 3000;
let hasGeminiInFile = false;
let hasNvidiaInFile = false;

for (const candidate of [envLocalPath, envPath]) {
  if (!fs.existsSync(candidate)) continue;
  const content = fs.readFileSync(candidate, 'utf8');
  if (/^\s*GEMINI_API_KEY\s*=\s*(?!["']?MY_GEMINI_API_KEY["']?)\S+/m.test(content)) {
    hasGeminiInFile = true;
  }
  if (/^\s*(NVIDIA_NIM_API_KEY|NVIDIA_API_KEY)\s*=\s*(?!["']?MY_NVIDIA_NIM_API_KEY["']?)\S+/m.test(content)) {
    hasNvidiaInFile = true;
  }
  const portMatch = content.match(/^\s*APP_PORT\s*=\s*(\d+)/m);
  if (portMatch && !process.env.APP_PORT) {
    port = Number(portMatch[1]);
  }
}

const hasGemini = Boolean(process.env.GEMINI_API_KEY) || hasGeminiInFile;
const hasNvidia = Boolean(process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY) || hasNvidiaInFile;

if (!hasEnvFile && !hasGemini && !hasNvidia) {
  console.warn('⚠ No se detectó archivo ".env" ni ".env.local".');
  console.warn('  Copia ".env.example" a ".env" y agrega tu GEMINI_API_KEY para habilitar la inferencia.');
} else {
  console.log(`✔ Configuración de entorno detectada (${hasEnvFile ? 'archivo .env' : 'variables de sistema'})`);
  console.log(`  • GEMINI_API_KEY    : ${hasGemini ? 'Configurada' : 'No configurada (requerida para Gemini/Web)'}`);
  console.log(`  • NVIDIA_NIM_API_KEY: ${hasNvidia ? 'Configurada' : 'Opcional (no configurada)'}`);
}

// Check port availability without failing if invoked during dev preview
const checkPort = (targetPort) =>
  new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') resolve(false);
        else resolve(true);
      })
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(targetPort, '127.0.0.1');
  });

const portFree = await checkPort(port);
if (!portFree) {
  console.warn(`⚠ El puerto ${port} ya está en uso en localhost. Puedes usar otro puerto con: APP_PORT=${port + 1} npm run local`);
} else {
  console.log(`✔ Puerto ${port} disponible en http://localhost:${port}`);
}

console.log('[Preflight Localhost] Verificación completada.\n');
