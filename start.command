#!/bin/bash
# Запуск сайта «Водяной» на macOS: двойной щелчок по этому файлу.
cd "$(dirname "$0")"

echo "Папка проекта: $(pwd)"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js не найден. Установите LTS с https://nodejs.org и попробуйте снова."
  read -r -p "Нажмите Enter для выхода... " _
  exit 1
fi

if [ ! -f package.json ]; then
  echo "[!] Здесь нет package.json. Положите этот файл в папку проекта."
  read -r -p "Нажмите Enter для выхода... " _
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Устанавливаю зависимости первый раз — 1-3 минуты..."
  echo
  npm install || { echo "[!] Не удалось установить зависимости. Проверьте интернет."; read -r -p "Enter для выхода... " _; exit 1; }
fi

echo
echo "Запускаю сайт. Не закрывайте это окно!"
echo "В браузере откройте: http://localhost:5173"
echo "Остановка: Ctrl+C или закрыть окно"
echo
npm run dev:vite
