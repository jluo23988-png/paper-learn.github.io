# 论文阅读管理平台 - 阿里云 ECS 一键部署脚本
# 在服务器上以管理员身份运行 PowerShell，执行此脚本

Write-Host "==============================" -ForegroundColor Cyan
Write-Host "  论文阅读管理平台 ECS 部署" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# 1. 检查 Python
Write-Host "[1/5] 检查 Python..." -ForegroundColor Yellow
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "Python 未安装，正在下载安装..." -ForegroundColor Yellow
    $url = "https://www.python.org/ftp/python/3.12.0/python-3.12.0-amd64.exe"
    $installer = "$env:TEMP\python-installer.exe"
    Invoke-WebRequest -Uri $url -OutFile $installer
    Start-Process -FilePath $installer -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1" -Wait
    Remove-Item $installer
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "Python 安装完成" -ForegroundColor Green
}
python --version

# 2. 下载项目代码
Write-Host "[2/5] 下载项目代码..." -ForegroundColor Yellow
$projectDir = "C:\paper-platform"
if (Test-Path $projectDir) {
    Remove-Item -Recurse -Force $projectDir
}
git clone https://github.com/jluo23988-png/paper-learn.github.io.git $projectDir 2>$null
if (-not $?) {
    Write-Host "Git 未安装，使用直接下载..." -ForegroundColor Yellow
    $zip = "$env:TEMP\paper-platform.zip"
    Invoke-WebRequest -Uri "https://github.com/jluo23988-png/paper-learn.github.io/archive/refs/heads/master.zip" -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $env:TEMP\paper-extract -Force
    Move-Item -Path "$env:TEMP\paper-extract\*" -Destination $projectDir -Force
    Remove-Item $zip
}
Set-Location $projectDir
Write-Host "代码下载完成" -ForegroundColor Green

# 3. 安装依赖
Write-Host "[3/5] 安装 Python 依赖..." -ForegroundColor Yellow
pip install flask PyPDF2 python-docx openai -q
Write-Host "依赖安装完成" -ForegroundColor Green

# 4. 创建配置
Write-Host "[4/5] 创建配置文件..." -ForegroundColor Yellow
$config = @{
    deepseek_api_key = "sk-ae506d7b2ce14d1da3a840724f779418"
    deepseek_base_url = "https://api.deepseek.com"
    model = "deepseek-chat"
}
$config | ConvertTo-Json | Out-File -FilePath "$projectDir\config.json" -Encoding UTF8
Write-Host "配置创建完成" -ForegroundColor Green

# 5. 开放防火墙端口 5000
Write-Host "[5/5] 配置防火墙..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "Paper Platform" -Direction Inbound -Port 5000 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue
Write-Host "端口 5000 已开放" -ForegroundColor Green

# 6. 创建启动脚本
$startScript = @'
@echo off
cd /d C:\paper-platform
python app.py
'@
$startScript | Out-File -FilePath "$projectDir\start.bat" -Encoding ASCII

# 7. 创建 Windows 服务（开机自启）
Write-Host "配置开机自启..." -ForegroundColor Yellow
$nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
$nssmZip = "$env:TEMP\nssm.zip"
Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip
Expand-Archive -Path $nssmZip -DestinationPath "$env:TEMP\nssm" -Force
$nssm = "$env:TEMP\nssm\nssm-2.24\win64\nssm.exe"
& $nssm install PaperPlatform "C:\paper-platform\start.bat" 2>$null
& $nssm set PaperPlatform AppDirectory "C:\paper-platform" 2>$null
& $nssm set PaperPlatform Start SERVICE_AUTO_START 2>$null
& $nssm start PaperPlatform 2>$null
Write-Host "服务已安装并启动" -ForegroundColor Green

Write-Host ""
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "  部署完成！" -ForegroundColor Green
Write-Host "  本地访问: http://localhost:5000" -ForegroundColor Green
Write-Host "  公网访问: http://8.137.190.254:5000" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""
Write-Host "重要：请在阿里云 ECS 安全组中开放 5000 端口！" -ForegroundColor Red
Write-Host "1. 打开阿里云控制台 -> ECS -> 安全组" -ForegroundColor White
Write-Host "2. 添加入方向规则: 端口 5000/5000, 授权对象 0.0.0.0/0" -ForegroundColor White
Start-Sleep -Seconds 5
