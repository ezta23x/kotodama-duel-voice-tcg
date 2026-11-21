#!/usr/bin/env bash
# 言灵对决（言霊デュエル）本地一键启动脚本（支持 macOS 双击 & Linux 终端运行）
set -e
cd "$(dirname "$0")"

PORT=8080
while lsof -i :"$PORT" >/dev/null 2>&1 || (command -v ss >/dev/null 2>&1 && ss -ltn | grep -q ":$PORT "); do
  PORT=$((PORT + 1))
done
URL="http://localhost:${PORT}/"

echo "正在启动本地服务：${URL}"
echo "按 Ctrl+C 可随时停止服务。"

(sleep 1 && if command -v open >/dev/null 2>&1; then open "$URL"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1; fi) &

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server "$PORT"
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes serve -l "$PORT" .
else
  echo "未检测到 Python3 或 Node.js，请安装任意一种后重试。"
  exit 1
fi
