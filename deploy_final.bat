@echo off
echo ===================================================
echo   DEPLOY DE FUNCIONALIDADES - RESIDENCIA MEDICA
echo ===================================================
echo.
echo 1. Adicionando alteracoes ao git...
git add .
echo.
echo 2. Commitando mudancas (Poups, Flashcards, Timer, Charts)...
git commit -m "feat: final touches - system popups, flashcards ui, exam timer and charts"
echo.
echo 3. Enviando para branch main (Vercel Production)...
git push origin main
echo.
echo ===================================================
echo   SUCESSO! CONFIRA O DASHBOARD DA VERCEL.
echo ===================================================
pause
