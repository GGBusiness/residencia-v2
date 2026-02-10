@echo off
echo ========================================
echo  Extração ENARE - Upload Direto Claude
echo ========================================
echo.
echo Este script envia PDFs DIRETAMENTE para Claude
echo SEM usar pdf-parse (que estava dando erro)
echo.

cd /d "c:\Geral\Alice\Provas Antigas\APP\residencia-app"

echo [1/5] ENARE 2021...
npx tsx scripts\extract-pdf-direct.ts "c:\Geral\Alice\Provas Antigas\ENARE-2021-Objetiva.pdf"
if errorlevel 1 echo    ERRO! Pulando...
echo.

echo [2/5] ENARE 2022...
npx tsx scripts\extract-pdf-direct.ts "c:\Geral\Alice\Provas Antigas\ENARE-2022-Objetiva.pdf"
if errorlevel 1 echo    ERRO! Pulando...
echo.

echo [3/5] ENARE 2023...
npx tsx scripts\extract-pdf-direct.ts "c:\Geral\Alice\Provas Antigas\ENARE-2023-Objetiva.pdf"
if errorlevel 1 echo    ERRO! Pulando...
echo.

echo [4/5] ENARE 2024...
npx tsx scripts\extract-pdf-direct.ts "c:\Geral\Alice\Provas Antigas\ENARE-2024-Objetiva-R1.pdf"
if errorlevel 1 echo    ERRO! Pulando...
echo.

echo [5/5] ENARE 2025...
npx tsx scripts\extract-pdf-direct.ts "c:\Geral\Alice\Provas Antigas\Banco de Provas - Enare - 2025 - @Casalmedresumos.pdf"
if errorlevel 1 echo    ERRO! Pulando...
echo.

echo ========================================
echo  TODOS PROCESSADOS!
echo ========================================
echo.
echo Arquivos SQL gerados na pasta do app:
dir /B import-enare-*.sql 2>nul
echo.
echo Abra o Supabase e execute cada SQL!
echo.
pause
