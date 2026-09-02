@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════════════════════════
echo  🎁 GiftMind AI 智能挑礼助手 —— 开发与源码调试模式
echo ═══════════════════════════════════════════════════════════════
echo.
cd /d "%~dp0"

if not exist node_modules (
    echo [1/2] 首次运行，正在自动安装依赖包...
    call npm install
)

echo [2/2] 正在启动 Vite 开发服务器...
echo 🌐 访问地址: http://127.0.0.1:5173/
echo.
start http://127.0.0.1:5173/
call npm run dev -- --host 127.0.0.1 --port 5173
pause
