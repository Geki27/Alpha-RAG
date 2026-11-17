@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" if not exist ".env.local" if exist ".env.example" (
  echo [Setup] Creando archivo .env desde .env.example...
  copy ".env.example" ".env" >nul
  echo [Aviso] Edita el archivo .env y coloca tu GEMINI_API_KEY antes de realizar consultas.
)

if not exist "node_modules" (
  echo [Setup] Instalando dependencias...
  call npm install
  if errorlevel 1 exit /b 1
)

echo [Launch] Compilando e iniciando AetherVector RAG en modo produccion local...
call npm run local
