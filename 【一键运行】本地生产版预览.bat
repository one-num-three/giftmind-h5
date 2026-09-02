@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════════════════════════
echo  🎁 GiftMind AI 智能挑礼助手 —— 生产发布版快速启动
echo ═══════════════════════════════════════════════════════════════
echo.
echo [1/2] 正在启动本地生产环境静态服务器...

cd /d "%~dp0"

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [2/2] 使用 Python 静态服务运行生产包 (dist)...
    echo.
    echo 🌐 访问地址: http://127.0.0.1:8080/
    echo 💡 提示：按 Ctrl+C 可停止运行。
    echo.
    start http://127.0.0.1:8080/
    cd dist
    python -m http.server 8080 --bind 127.0.0.1
    goto end
)

where npx >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [2/2] 使用 Vite 预览服务运行...
    echo.
    echo 🌐 访问地址: http://127.0.0.1:5173/
    echo.
    start http://127.0.0.1:5173/
    npx vite preview --port 5173 --host 127.0.0.1
    goto end
)

echo ❌ 未检测到 Python 或 Node 环境，请先安装 Node.js 或 Python！
pause

:end
