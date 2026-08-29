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

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce
Name: "startupicon"; Description: "Run FocusGrow automatically when Windows starts"; GroupDescription: "Startup Options:"; Flags: unchecked

[Files]
; Main executable & core DLLs
Source: "bin\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "bin\WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion
; Web UI Assets (HTML, CSS, JS, Audio, Icons)
Source: "bin\ui\*"; DestDir: "{app}\ui"; Flags: ignoreversion recursesubdirs createallsubdirs
; Source app icon
Source: "app.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\app.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; IconFilename: "{app}\app.ico"
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startupicon; IconFilename: "{app}\app.ico"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
