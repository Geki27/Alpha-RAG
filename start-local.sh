#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f ".env" ] && [ ! -f ".env.local" ] && [ -f ".env.example" ]; then
  echo "[Setup] Creando archivo .env desde .env.example..."
  cp .env.example .env
  echo "[Aviso] Edita el archivo .env y coloca tu GEMINI_API_KEY antes de realizar consultas."
fi

if [ ! -d "node_modules" ]; then
  echo "[Setup] Instalando dependencias..."
  npm install
fi

echo "[Launch] Compilando e iniciando AetherVector RAG en modo producción local..."
npm run local
