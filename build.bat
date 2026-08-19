@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   FocusGrow C++ Build Script (MSVC Visual Studio 2022)
echo ========================================================

rem Setup MSVC environment
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"

if not exist bin (
    mkdir bin
)

echo.
echo Compiling resources...
rc.exe /nologo /fo bin\resource.res resource.rc

echo.
echo Compiling FocusGrow.exe...

cl.exe /nologo /EHsc /std:c++17 /O2 ^
    /I"packages\WebView2\build\native\include" ^
    /I"src" ^
    src\main.cpp bin\resource.res ^
    user32.lib gdi32.lib psapi.lib dwmapi.lib shell32.lib ole32.lib oleaut32.lib gdiplus.lib ^
    "packages\WebView2\build\native\x64\WebView2Loader.dll.lib" ^
    /Fe"bin\FocusGrow.exe" /Fo"bin\\"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Compilation failed!
    exit /b %errorlevel%
)

echo.
echo Copying dependencies and assets...
copy /Y "packages\WebView2\build\native\x64\WebView2Loader.dll" "bin\" >nul
if not exist "bin\ui" mkdir "bin\ui"
xcopy /E /Y /I "ui" "bin\ui" >nul

echo.
echo ========================================================
echo [SUCCESS] FocusGrow.exe built successfully in bin\
echo ========================================================
