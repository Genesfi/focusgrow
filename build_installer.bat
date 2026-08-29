@echo off
setlocal
echo ========================================================
echo   Building FocusGrow Installer with Inno Setup 6
echo ========================================================

:: 1. Sync UI assets and build the latest binary
echo [1/3] Syncing UI assets to bin\ui\...
taskkill /F /IM FocusGrow.exe >nul 2>&1
if not exist "bin\ui" mkdir "bin\ui"
xcopy /E /I /Y "ui\*" "bin\ui\" >nul

echo [2/3] Building FocusGrow.exe...
call build.bat
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed. Installer creation aborted.
    exit /b 1
)

:: 2. Locate Inno Setup Compiler
set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if not exist "%ISCC_PATH%" (
    set "ISCC_PATH=C:\Program Files\Inno Setup 6\ISCC.exe"
)

if not exist "%ISCC_PATH%" (
    echo [ERROR] Inno Setup 6 ISCC.exe was not found in Program Files.
    echo Please install Inno Setup 6 from https://jrsoftware.org/isinfo.php
    exit /b 1
)

:: 3. Compile Installer into dist\
echo [3/3] Compiling installer package with Inno Setup 6...
if not exist "dist" mkdir "dist"
"%ISCC_PATH%" "installer.iss"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Inno Setup compilation failed.
    exit /b 1
)

echo.
echo ========================================================
echo  [SUCCESS] FocusGrow Installer created in dist\
echo ========================================================
dir "dist\*.exe"
