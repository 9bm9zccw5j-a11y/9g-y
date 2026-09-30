@echo off
chcp 65001 >nul
title Водяной — запуск сайта
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [!] Node.js не найден.
  echo      Скачайте LTS версию с https://nodejs.org
  echo      установите и запустите этот файл заново.
  echo.
  pause
  exit /b
)

if not exist node_modules (
  echo.
  echo  Устанавливаю зависимости первый раз — это 1-3 минуты...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  [!] Не удалось установить зависимости. Проверьте интернет.
    echo.
    pause
    exit /b
  )
)

echo.
echo  Запускаю сайт. Не закрывайте это окно!
echo  В браузере откройте адрес, который появится ниже.
echo.
echo  Остановить сайт: закройте окно или нажмите Ctrl+C
echo.
call npm run dev:vite
pause
