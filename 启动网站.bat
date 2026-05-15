@echo off
chcp 65001 >nul
title 论文阅读管理平台

echo ================================
echo     论文阅读管理平台
echo ================================
echo.

cd /d "%~dp0"

:: Find Python
set PYTHON=
if exist "D:\anaconda3\python.exe" set PYTHON=D:\anaconda3\python.exe
if exist "C:\Python3\python.exe" set PYTHON=C:\Python3\python.exe
if "%PYTHON%"=="" where python >nul 2>&1 && set PYTHON=python
if "%PYTHON%"=="" (
    echo [错误] 未找到 Python
    pause
    exit /b 1
)

echo 启动中，请稍候...
start "" http://localhost:5000

echo.
echo 服务地址: http://localhost:5000
echo 关闭此窗口即可停止服务
echo ================================

%PYTHON% app.py

pause
