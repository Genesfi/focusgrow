; ========================================================
; FocusGrow Professional Windows Setup Script (Inno Setup 6)
; ========================================================

#define MyAppName "FocusGrow"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Genesfi"
#define MyAppURL "https://github.com/Genesfi/focusgrow"
#define MyAppExeName "FocusGrow.exe"

[Setup]
; Unique AppId generated for FocusGrow
AppId={{D8A1C52E-5B39-44F2-8729-9F89B2B612C9}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} v{#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DisableProgramGroupPage=yes
; Application icon
SetupIconFile=app.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
; Modern styling and high compression
WizardStyle=modern
Compression=lzma2/ultra64
SolidCompression=yes
OutputDir=dist
OutputBaseFilename=FocusGrow_Setup_v{#MyAppVersion}
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesInstallIn64BitMode=x64compatible
; Information before installation (Read This Before Install)
InfoBeforeFile=INSTALLER_INFO.txt

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce
Name: "startupicon"; Description: "Run FocusGrow automatically when Windows starts"; GroupDescription: "Startup Options:"; Flags: unchecked
Name: "startupytmpx"; Description: "Run YTMPX Server (YouTube Music Sync) on Windows startup"; GroupDescription: "Startup Options:"; Flags: unchecked

[Files]
; Main executable & core DLLs
Source: "bin\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "bin\WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion
; Web UI Assets (HTML, CSS, JS, Audio, Icons)
Source: "bin\ui\*"; DestDir: "{app}\ui"; Flags: ignoreversion recursesubdirs createallsubdirs
; Source app icon
Source: "app.ico"; DestDir: "{app}"; Flags: ignoreversion
; YTMPX Server (YouTube Music background service)
Source: "bin\ytmpx-server\*"; DestDir: "{app}\ytmpx-server"; Flags: ignoreversion recursesubdirs createallsubdirs
; YTMPX Browser Extension (Unpacked extension for Chrome/Edge/Brave)
Source: "bin\extension-ytmpx\*"; DestDir: "{app}\extension-ytmpx"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\app.ico"
Name: "{autoprograms}\{#MyAppName}\YTMPX Server"; Filename: "{app}\ytmpx-server\ytmpx_ui.exe"; IconFilename: "{app}\app.ico"
Name: "{autoprograms}\{#MyAppName}\YTMPX Extension Folder"; Filename: "{win}\explorer.exe"; Parameters: """{app}\extension-ytmpx"""
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; IconFilename: "{app}\app.ico"
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startupicon; IconFilename: "{app}\app.ico"
Name: "{userstartup}\YTMPX Server"; Filename: "{app}\ytmpx-server\ytmpx_ui.exe"; Tasks: startupytmpx

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
Filename: "{app}\ytmpx-server\ytmpx_ui.exe"; Description: "Start YTMPX Server now (for YouTube Music sync)"; Flags: nowait postinstall skipifsilent unchecked
Filename: "{win}\explorer.exe"; Parameters: """{app}\extension-ytmpx"""; Description: "Open YTMPX Extension folder (to load into Chrome / Edge / Brave)"; Flags: nowait postinstall skipifsilent unchecked

[UninstallDelete]
; Clean up runtime cache, WebView2 user data, and temporary files generated after install
Type: filesandordirs; Name: "{app}\FocusGrow.exe.WebView2"
Type: filesandordirs; Name: "{app}\EBWebView"
Type: filesandordirs; Name: "{app}\ytmpx-server"
Type: filesandordirs; Name: "{app}\extension-ytmpx"
Type: filesandordirs; Name: "{app}\ui"
Type: filesandordirs; Name: "{app}\*"
Type: dirifempty; Name: "{app}"

[Code]
// Helper to terminate active instances so files are not locked
procedure KillProcess(ProcessName: String);
var
  ResultCode: Integer;
begin
  Exec('taskkill.exe', '/F /IM ' + ProcessName + ' /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

function InitializeSetup(): Boolean;
begin
  KillProcess('FocusGrow.exe');
  KillProcess('ytmpx_ui.exe');
  KillProcess('node.exe');
  Result := True;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
  begin
    // Terminate processes before file removal
    KillProcess('FocusGrow.exe');
    KillProcess('ytmpx_ui.exe');
    KillProcess('node.exe');
    Sleep(500);
  end;
end;
