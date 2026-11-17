# AetherVector RAG — Guía de Ejecución en Localhost

Aplicación full-stack (Express + React + Vite + WebGL Three.js) para consultas RAG sobre biblioteca PDF física local (`/libreria`), búsqueda web técnica e inferencia multi-proveedor (Google Gemini y NVIDIA NIM).

---

## Requisitos Previos

- **Node.js** `>= 20.0.0` (recomendado `v22 LTS`)
- **npm** `>= 10.0.0`
- Clave de API de **Google AI Studio** (`GEMINI_API_KEY`) y/o **NVIDIA NIM** (`NVIDIA_NIM_API_KEY`).

---

## Instalación Rápida en Local

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   ```bash
   cp .env.example .env
   ```
   Edita `.env` (o `.env.local`) y asigna tu clave real:
   ```env
   GEMINI_API_KEY="tu_clave_aqui"
   NVIDIA_NIM_API_KEY="tu_clave_opcional_aqui"
   APP_PORT=3000
   ```

---

## Modos de Lanzamiento

### 1. Modo Producción Local Optimizado (Recomendado)
Ejecuta verificación previa, compila los bundles con división de chunks (`vendor-react`, `vendor-three`, `vendor-markdown`, `vendor-ui`), habilita compresión gzip HTTP, cabeceras de caché inmutables (`1 año` para `/assets`) y sirve la app completa en `http://localhost:3000`:

```bash
npm run local
```

También puedes usar los lanzadores directos:
- **macOS / Linux:** `bash start-local.sh`
- **Windows:** doble clic o `start-local.bat`

### 2. Modo Desarrollo (Vite Middleware en vivo)
Ideal si estás editando el código fuente:
```bash
npm run local:dev
```
*(o `npm run dev` directamente)*

### 3. Cambiar el Puerto
Si el puerto `3000` está ocupado en tu equipo:
```bash
APP_PORT=3001 npm run local
```
*(En Windows PowerShell: `$env:APP_PORT=3001; npm run local`)*

---

## Endpoints y Verificación

- **Aplicación Web:** `http://localhost:3000`
- **Diagnóstico / Healthcheck:** `http://localhost:3000/api/health`
- **Autodetección de Modelos:** `http://localhost:3000/api/models`
- **Biblioteca Física Local:** `./libreria/` (persiste PDFs, textos extraídos y vectores entre reinicios)

---

## Scripts Disponibles

| Comando | Descripción |
|---|---|
| `npm run local` | Preflight + Build de producción + Servidor optimizado |
| `npm run build` | Genera la compilación optimizada en `dist/` |
| `npm start` | Inicia Express sirviendo `dist/` con `NODE_ENV=production` |
| `npm run dev` | Inicia Express + Vite en modo desarrollo |
| `npm run check` | Verifica versión de Node, dependencias, `.env` y puerto |
| `npm run typecheck` | Valida tipos TypeScript (`tsc --noEmit`) |
| `npm run clean` | Limpia `dist/` y artefactos temporales |
