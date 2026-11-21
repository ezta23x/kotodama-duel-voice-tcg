@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=8080
:find_port
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>&1
if %errorlevel%==0 (
  set /a PORT+=1
  goto :find_port
)

set CMD_TYPE=
where py >nul 2>&1 && set CMD_TYPE=py
if not defined CMD_TYPE (
  where python >nul 2>&1 && set CMD_TYPE=python
)
if not defined CMD_TYPE (
  where npx >nul 2>&1 && set CMD_TYPE=npx
)
if not defined CMD_TYPE (
  echo 未检测到 Python 或 Node.js，请安装 Python 3 后重试。
  pause
  goto :eof
)

echo 正在启动言灵对决本地服务：http://localhost:%PORT%/
echo 关闭此窗口即可停止服务。
start "" /b cmd /c "timeout /t 1 /nobreak >nul & start "" http://localhost:%PORT%/"

if "%CMD_TYPE%"=="py" py -m http.server %PORT%
if "%CMD_TYPE%"=="python" python -m http.server %PORT%
if "%CMD_TYPE%"=="npx" npx --yes serve -l %PORT% .
