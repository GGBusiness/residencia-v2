@echo off
echo ========================================
echo  Extração Automática de Questões ENARE
echo ========================================
echo.

cd /d "c:\Geral\Alice\Provas Antigas\APP\residencia-app"

echo [1/5] Processando ENARE 2021...
npx tsx scripts\extract-single-pdf.ts "c:\Geral\Alice\Provas Antigas\ENARE-2021-Objetiva.pdf"
echo.

echo [2/5] Processando ENARE 2022...
npx tsx scripts\extract-single-pdf.ts "c:\Geral\Alice\Provas Antigas\ENARE-2022-Objetiva.pdf"
echo.

echo [3/5] Processando ENARE 2023...
npx tsx scripts\extract-single-pdf.ts "c:\Geral\Alice\Provas Antigas\ENARE-2023-Objetiva.pdf"
echo.

echo [4/5] Processando ENARE 2024...
npx tsx scripts\extract-single-pdf.ts "c:\Geral\Alice\Provas Antigas\ENARE-2024-Objetiva-R1.pdf"
echo.

echo [5/5] Processando ENARE 2025...
npx tsx scripts\extract-single-pdf.ts "c:\Geral\Alice\Provas Antigas\Banco de Provas - Enare - 2025 - @Casalmedresumos.pdf"
echo.

echo ========================================
echo  CONCLUÍDO!
echo ========================================
echo.
echo Arquivos SQL gerados:
echo  - import-enare-2021.sql
echo  - import-enare-2022.sql
echo  - import-enare-2023.sql
echo  - import-enare-2024.sql
echo  - import-enare-2025.sql
echo.
echo Execute cada arquivo SQL no Supabase!
echo.
pause
