# Document Management System - Windows PowerShell Setup Script
# This script sets up the development environment and builds the desktop application for Windows

param(
    [switch]$SkipBuild,
    [switch]$Help,
    [string]$InstallPath = ".\document-management-system"
)

# Enable strict mode for better error handling
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Configuration
$APP_NAME = "Document Management System"
$NODE_VERSION = "18"
$REQUIRED_NODE_MAJOR = 16
$REPO_URL = "https://github.com/yourcompany/document-management-system.git"

# Color functions for better output
function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Blue
    Write-Host " $Message" -ForegroundColor Blue
    Write-Host "============================================" -ForegroundColor Blue
    Write-Host ""
}

function Write-Step {
    param([string]$Message)
    Write-Host "📋 $Message" -ForegroundColor Magenta
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

# Show help information
function Show-Help {
    Write-Host @"
Document Management System - Windows Setup Script

DESCRIPTION:
    Automatically sets up the development environment and builds the DMS desktop application.

SYNTAX:
    .\setup.ps1 [[-InstallPath] <String>] [-SkipBuild] [-Help]

PARAMETERS:
    -InstallPath <String>
        Specifies the installation directory. Default: .\document-management-system
        
    -SkipBuild
        Skip the build process after setup
        
    -Help
        Display this help message

EXAMPLES:
    .\setup.ps1
        Run setup with default settings
        
    .\setup.ps1 -InstallPath "C:\Apps\DMS"
        Install to custom directory
        
    .\setup.ps1 -SkipBuild
        Setup without building
        
    .\setup.ps1 -InstallPath "D:\Projects\DMS" -SkipBuild
        Custom path without building

REQUIREMENTS:
    - Windows 10 or later
    - PowerShell 5.0 or later
    - Internet connection for downloads
    - Administrator privileges (for some installations)

OUTPUT:
    Built applications will be in the 'dist' subfolder of the installation directory.
"@
}

# Check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check if command exists
function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Check system requirements
function Test-SystemRequirements {
    Write-Step "Checking system requirements..."
    
    # Check Windows version
    $osVersion = [System.Environment]::OSVersion.Version
    $windows10Build = [System.Version]"10.0.10240"
    
    if ($osVersion -lt $windows10Build) {
        Write-Error "Windows 10 or later is required. Current version: $($osVersion)"
        exit 1
    }
    
    Write-Success "Operating System: Windows $($osVersion.Major).$($osVersion.Minor) Build $($osVersion.Build)"
    
    # Check PowerShell version
    $psVersion = $PSVersionTable.PSVersion
    if ($psVersion.Major -lt 5) {
        Write-Error "PowerShell 5.0 or later is required. Current version: $psVersion"
        exit 1
    }
    
    Write-Success "PowerShell Version: $psVersion"
    
    # Check architecture
    $arch = $env:PROCESSOR_ARCHITECTURE
    Write-Success "Architecture: $arch"
    
    # Check available disk space
    $drive = Split-Path -Qualifier (Get-Location)
    $freeSpace = [math]::Round((Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='$drive'").FreeSpace / 1GB, 2)
    
    if ($freeSpace -lt 2) {
        Write-Warning "Low disk space: ${freeSpace}GB available. At least 2GB recommended."
    } else {
        Write-Success "Available disk space: ${freeSpace}GB"
    }
    
    # Check internet connectivity
    try {
        Test-NetConnection -ComputerName "nodejs.org" -Port 443 -WarningAction SilentlyContinue | Out-Null
        Write-Success "Internet connectivity: OK"
    }
    catch {
        Write-Warning "Internet connectivity check failed. Some downloads may fail."
    }
    
    Write-Host ""
}

# Install Chocolatey if not present
function Install-Chocolatey {
    if (Test-Command "choco") {
        Write-Success "Chocolatey is already installed"
        return
    }
    
    Write-Step "Installing Chocolatey package manager..."
    
    if (-not (Test-Administrator)) {
        Write-Warning "Administrator privileges recommended for Chocolatey installation"
        $response = Read-Host "Continue anyway? (y/N)"
        if ($response -notmatch "^[Yy]$") {
            Write-Info "Please run PowerShell as Administrator for automatic installation"
            Write-Info "Or install Node.js manually from https://nodejs.org/"
            exit 1
        }
    }
    
    try {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        
        # Refresh environment variables
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Success "Chocolatey installed successfully"
    }
    catch {
        Write-Error "Failed to install Chocolatey: $($_.Exception.Message)"
        Write-Info "Please install Node.js manually from https://nodejs.org/"
        exit 1
    }
}

# Install Node.js if not present or outdated
function Install-NodeJS {
    $nodeInstalled = Test-Command "node"
    $needsInstall = $false
    
    if ($nodeInstalled) {
        try {
            $nodeVersionOutput = node --version
            $nodeVersionNumber = $nodeVersionOutput -replace "v", ""
            $nodeMajorVersion = [int]($nodeVersionNumber.Split('.')[0])
            
            if ($nodeMajorVersion -ge $REQUIRED_NODE_MAJOR) {
                Write-Success "Node.js $nodeVersionOutput is already installed"
                return
            } else {
                Write-Warning "Node.js version $nodeVersionOutput is too old (minimum: v$REQUIRED_NODE_MAJOR)"
                $needsInstall = $true
            }
        }
        catch {
            Write-Warning "Could not determine Node.js version"
            $needsInstall = $true
        }
    } else {
        $needsInstall = $true
    }
    
    if ($needsInstall) {
        Write-Step "Installing Node.js..."
        
        # Try multiple installation methods
        $installSuccess = $false
        
        # Method 1: Chocolatey
        if (Test-Command "choco") {
            try {
                Write-Info "Installing Node.js via Chocolatey..."
                choco install nodejs --version=$NODE_VERSION -y
                $installSuccess = $true
            }
            catch {
                Write-Warning "Chocolatey installation failed, trying alternative method..."
            }
        }
        
        # Method 2: Direct download
        if (-not $installSuccess) {
            try {
                Write-Info "Downloading Node.js installer..."
                
                $nodeUrl = "https://nodejs.org/dist/v$NODE_VERSION.0/node-v$NODE_VERSION.0-x64.msi"
                $installerPath = "$env:TEMP\nodejs-installer.msi"
                
                Invoke-WebRequest -Uri $nodeUrl -OutFile $installerPath -UseBasicParsing
                
                Write-Info "Running Node.js installer..."
                Start-Process msiexec.exe -Wait -ArgumentList "/i `"$installerPath`" /quiet /norestart"
                
                Remove-Item $installerPath -Force
                $installSuccess = $true
            }
            catch {
                Write-Warning "Direct download failed: $($_.Exception.Message)"
            }
        }
        
        # Method 3: Winget (Windows 10 1809+)
        if (-not $installSuccess -and (Test-Command "winget")) {
            try {
                Write-Info "Installing Node.js via Winget..."
                winget install OpenJS.NodeJS
                $installSuccess = $true
            }
            catch {
                Write-Warning "Winget installation failed: $($_.Exception.Message)"
            }
        }
        
        if (-not $installSuccess) {
            Write-Error "All automatic installation methods failed."
            Write-Info "Please install Node.js manually from https://nodejs.org/"
            Write-Info "Download the Windows Installer (.msi) for the latest LTS version"
            exit 1
        }
        
        # Refresh environment variables
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        # Verify installation
        Start-Sleep -Seconds 3
        if (Test-Command "node") {
            $newVersion = node --version
            Write-Success "Node.js $newVersion installed successfully"
        } else {
            Write-Error "Node.js installation verification failed. Please restart PowerShell and try again."
            exit 1
        }
    }
}

# Install Git if not present
function Install-Git {
    if (Test-Command "git") {
        Write-Success "Git is already installed"
        return
    }
    
    Write-Step "Installing Git..."
    
    if (Test-Command "choco") {
        try {
            choco install git -y
            Write-Success "Git installed via Chocolatey"
        }
        catch {
            Write-Warning "Failed to install Git via Chocolatey"
        }
    } elseif (Test-Command "winget") {
        try {
            winget install Git.Git
            Write-Success "Git installed via Winget"
        }
        catch {
            Write-Warning "Failed to install Git via Winget"
        }
    } else {
        Write-Warning "Git not found. Some features may be limited."
        Write-Info "You can install Git from https://git-scm.com/download/win"
    }
    
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Setup project structure
function Initialize-Project {
    Write-Step "Setting up project structure..."
    
    # Create installation directory
    if (-not (Test-Path $InstallPath)) {
        New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
        Write-Success "Created installation directory: $InstallPath"
    }
    
    # Change to project directory
    Set-Location $InstallPath
    $script:ProjectPath = Get-Location
    
    Write-Success "Working directory: $ProjectPath"
    
    # Create package.json
    Write-Step "Creating package.json..."
    
    $packageJson = @{
        name = "document-management-system"
        version = "1.0.0"
        description = "Enterprise Document Management System - Desktop Application"
        main = "main.js"
        author = "Your Company"
        license = "MIT"
        scripts = @{
            start = "electron ."
            dev = "SET NODE_ENV=development && electron ."
            build = "electron-builder"
            "build-win" = "electron-builder --win"
            "build-mac" = "electron-builder --mac"
            "build-linux" = "electron-builder --linux"
            "build-all" = "electron-builder --win --mac --linux"
            postinstall = "electron-builder install-app-deps"
        }
        build = @{
            appId = "com.yourcompany.dms"
            productName = "Document Management System"
            directories = @{
                output = "dist"
                buildResources = "build"
            }
            files = @(
                "main.js",
                "preload.js", 
                "src/**/*",
                "assets/**/*",
                "node_modules/**/*"
            )
            win = @{
                target = @(
                    @{ target = "nsis"; arch = @("x64") },
                    @{ target = "portable"; arch = @("x64") }
                )
                icon = "assets/icon.ico"
            }
            nsis = @{
                oneClick = $false
                allowToChangeInstallationDirectory = $true
                createDesktopShortcut = $true
                createStartMenuShortcut = $true
            }
        }
        dependencies = @{
            "better-sqlite3" = "^8.7.0"
            "uuid" = "^9.0.1"
            "mime-types" = "^2.1.35"
            "electron-log" = "^4.4.8"
        }
        devDependencies = @{
            electron = "^27.1.0"
            "electron-builder" = "^24.6.4"
        }
    }
    
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json" -Encoding UTF8
    Write-Success "package.json created"
    
    # Create directory structure
    $directories = @("src", "assets", "build", "build/resources")
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    Write-Success "Directory structure created"
}

# Install project dependencies
function Install-Dependencies {
    Write-Step "Installing project dependencies..."
    
    try {
        # Update npm to latest version
        Write-Info "Updating npm to latest version..."
        npm install -g npm@latest
        
        # Install project dependencies
        Write-Info "Installing Electron and other dependencies..."
        npm install
        
        Write-Success "Dependencies installed successfully"
    }
    catch {
        Write-Error "Failed to install dependencies: $($_.Exception.Message)"
        Write-Info "Try running: npm install --verbose"
        exit 1
    }
}

# Create application files
function New-ApplicationFiles {
    Write-Step "Creating application files..."
    
    # Create main.js
    if (-not (Test-Path "main.js")) {
        Write-Info "Creating main.js..."
        
        $mainJs = @'
// main.js - Electron Main Process
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const log = require('electron-log');

let mainWindow;
let db;

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Create main window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        show: false
    });

    mainWindow.loadFile('src/index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        log.info('Application started successfully');
    });

    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

// Initialize database
function initializeDatabase() {
    const appDataPath = app.getPath('userData');
    const dbPath = path.join(appDataPath, 'documents.db');
    
    db = new Database(dbPath);
    
    // Create tables
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role_id INTEGER,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            privileges TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    
    // Insert default admin user and role
    try {
        db.exec(`
            INSERT OR IGNORE INTO roles (name, description, privileges) 
            VALUES ('Administrator', 'Full system access', '["read", "edit", "delete", "admin", "scan", "upload", "print", "email"]');
            
            INSERT OR IGNORE INTO users (username, email, password, role_id) 
            VALUES ('admin', 'admin@example.com', 'admin123', 1);
        `);
    } catch (error) {
        log.error('Database initialization error:', error);
    }
}

// IPC handlers
ipcMain.handle('db-query', async (event, sql, params = []) => {
    try {
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
            const stmt = db.prepare(sql);
            const result = stmt.all(params);
            return { success: true, data: result };
        } else {
            const stmt = db.prepare(sql);
            const result = stmt.run(params);
            return { success: true, changes: result.changes, lastInsertRowid: result.lastInsertRowid };
        }
    } catch (error) {
        log.error('Database error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-app-info', async () => {
    return {
        version: app.getVersion(),
        name: app.getName(),
        dataPath: app.getPath('userData')
    };
});

// App event handlers
app.whenReady().then(() => {
    initializeDatabase();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (db) db.close();
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
'@
        
        Set-Content "main.js" -Value $mainJs -Encoding UTF8
    }
    
    # Create preload.js
    if (-not (Test-Path "preload.js")) {
        Write-Info "Creating preload.js..."
        
        $preloadJs = @'
// preload.js - Secure communication bridge
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    query: (sql, params) => ipcRenderer.invoke('db-query', sql, params),
    getAppInfo: () => ipcRenderer.invoke('get-app-info'),
    platform: process.platform
});

contextBridge.exposeInMainWorld('logger', {
    info: (...args) => console.log('[RENDERER]', ...args),
    error: (...args) => console.error('[RENDERER]', ...args),
    warn: (...args) => console.warn('[RENDERER]', ...args)
});
'@
        
        Set-Content "preload.js" -Value $preloadJs -Encoding UTF8
    }
    
    # Create index.html
    if (-not (Test-Path "src/index.html")) {
        Write-Info "Creating src/index.html..."
        
        $indexHtml = @'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Management System</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .container {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            max-width: 400px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }

        h1 {
            color: #333;
            margin-bottom: 20px;
        }

        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }

        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: #555;
        }

        input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e1e5e9;
            border-radius: 10px;
            font-size: 14px;
        }

        input:focus {
            outline: none;
            border-color: #667eea;
        }

        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 10px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            width: 100%;
        }

        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }

        .info {
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 10px;
            font-size: 12px;
            text-align: left;
        }

        .app-info {
            position: fixed;
            bottom: 10px;
            left: 10px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.7);
        }

        .success {
            display: none;
            color: green;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="app-info" id="appInfo"></div>
    
    <div class="container">
        <h1>Document Management System</h1>
        <p style="margin-bottom: 20px; color: #666;">Desktop Edition</p>
        
        <form id="loginForm">
            <div class="form-group">
                <label for="username">Username:</label>
                <input type="text" id="username" value="admin" required>
            </div>
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" value="admin123" required>
            </div>
            <button type="submit">Login</button>
        </form>
        
        <div class="info">
            <strong>Setup Complete!</strong><br>
            Default login: admin / admin123<br><br>
            <strong>Next Steps:</strong><br>
            1. Replace this file with the complete DMS application<br>
            2. Add all the features from the original HTML<br>
            3. Test with: npm start<br>
            4. Build with: npm run build
        </div>
        
        <div id="loginSuccess" class="success">
            ✅ Login successful! Application is working correctly.
        </div>
    </div>

    <script>
        // Initialize app info
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                const appInfo = await window.electronAPI.getAppInfo();
                document.getElementById('appInfo').textContent = `${appInfo.name} v${appInfo.version} - ${window.electronAPI.platform}`;
            } catch (error) {
                console.error('Failed to get app info:', error);
            }
        });

        // Handle login
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            try {
                const result = await window.electronAPI.query(
                    'SELECT * FROM users WHERE username = ? AND password = ?',
                    [username, password]
                );
                
                if (result.success && result.data.length > 0) {
                    document.getElementById('loginSuccess').style.display = 'block';
                    window.logger.info('Login successful for user:', username);
                } else {
                    alert('Invalid credentials');
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('Login failed: ' + error.message);
            }
        });
    </script>
</body>
</html>
'@
        
        Set-Content "src/index.html" -Value $indexHtml -Encoding UTF8
    }
    
    # Create placeholder icon
    if (-not (Test-Path "assets/icon.png")) {
        Write-Info "Creating placeholder icon..."
        
        # Create a simple colored rectangle as PNG (base64)
        $iconBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        $iconBytes = [Convert]::FromBase64String($iconBase64)
        [System.IO.File]::WriteAllBytes("assets/icon.png", $iconBytes)
        
        # Copy for Windows
        Copy-Item "assets/icon.png" "assets/icon.ico" -Force
    }
    
    Write-Success "Application files created"
}

# Build application
function Build-Application {
    Write-Step "Building application for Windows..."
    
    try {
        npm run build-win
        Write-Success "Application built successfully"
        
        # Show build results
        if (Test-Path "dist") {
            $buildFiles = Get-ChildItem "dist" -File
            Write-Info "Build outputs:"
            foreach ($file in $buildFiles) {
                $sizeMB = [math]::Round($file.Length / 1MB, 2)
                Write-Host "   📦 $($file.Name) (${sizeMB} MB)" -ForegroundColor Cyan
            }
        }
    }
    catch {
        Write-Error "Build failed: $($_.Exception.Message)"
        Write-Info "You can build later with: npm run build-win"
    }
}

# Show completion message
function Show-Completion {
    $buildPath = Join-Path $ProjectPath "dist"
    
    Write-Host ""
    Write-Success "🎉 Setup completed successfully!"
    Write-Host ""
    Write-Host "📁 Project Location: " -NoNewline -ForegroundColor Blue
    Write-Host "$ProjectPath"
    Write-Host ""
    Write-Host "🚀 Available Commands:" -ForegroundColor Blue
    Write-Host "   npm start          - Run the application"
    Write-Host "   npm run dev        - Run in development mode"
    Write-Host "   npm run build-win  - Build Windows installer"
    Write-Host "   npm run build-all  - Build for all platforms"
    Write-Host ""
    Write-Host "📦 Build Output: " -NoNewline -ForegroundColor Blue
    Write-Host "$buildPath"
    Write-Host ""
    Write-Host "⚠️  Important Notes:" -ForegroundColor Yellow
    Write-Host "   • Replace src/index.html with the complete DMS application"
    Write-Host "   • The current files are just a working foundation"
    Write-Host "   • Default login: admin / admin123"
    Write-Host ""
    Write-Host "🔗 Next Steps:" -ForegroundColor Green
    Write-Host "   1. cd `"$InstallPath`""
    Write-Host "   2. Replace placeholder files with full DMS code"
    Write-Host "   3. npm start  # Test the application"
    Write-Host "   4. npm run build-win  # Create installer"
    Write-Host ""
}

# Main execution function
function Main {
    try {
        Write-Header "$APP_NAME - Windows Setup"
        
        if ($Help) {
            Show-Help
            return
        }
        
        Test-SystemRequirements
        Install-Chocolatey
        Install-NodeJS
        Install-Git
        Initialize-Project
        Install-Dependencies
        New-ApplicationFiles
        
        if (-not $SkipBuild) {
            Write-Host ""
            $response = Read-Host "Build the application now? (Y/n)"
            if ($response -eq "" -or $response -match "^[Yy]") {
                Build-Application
            } else {
                Write-Warning "Skipping build. You can build later with 'npm run build-win'"
            }
        }
        
        Show-Completion
    }
    catch {
        Write-Error "Setup failed: $($_.Exception.Message)"
        Write-Host ""
        Write-Host "Troubleshooting:" -ForegroundColor Yellow
        Write-Host "• Ensure you have internet connectivity"
        Write-Host "• Try running PowerShell as Administrator"
        Write-Host "• Check Windows version (Windows 10+ required)"
        Write-Host "• Manually install Node.js from https://nodejs.org/"
        exit 1
    }
}

# Execute main function
Main
