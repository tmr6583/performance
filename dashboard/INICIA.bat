@echo off
setlocal enabledelayedexpansion

set "DASH=%~dp0"
if "%DASH:~-1%"=="\" set "DASH=%DASH:~0,-1%"

set "PIDFILE=%DASH%\.dev.pid"
set "INITLOG=%DASH%\.inicia.log"
set "SERVERLOG=%DASH%\.dev.log"

if not exist "%DASH%\package.json" (
    echo ERRO: package.json nao encontrado em %DASH%
    pause
    exit /b 1
)

if "%PORT%"=="" set "PORT=3100"
if "%JWT_SECRET%"=="" set "JWT_SECRET=local-dev-secret-please-change"
set "NEXT_PUBLIC_BASE_PATH="

set "ACTION=%~1"
if "%ACTION%"=="" (
    set "INTERACTIVE=1"
    goto prompt
)
goto dispatch

:prompt
cls
echo ========================================
echo       PERFORMANCE DASHBOARD MENU
echo ========================================
echo   1 - Iniciar
echo   2 - Reiniciar
echo   3 - Parar
echo   4 - Status
echo   5 - Sair
echo ========================================
set "CHOICE="
set /p CHOICE="Opcao: "
if "%CHOICE%"=="1" set "ACTION=start"
if "%CHOICE%"=="2" set "ACTION=restart"
if "%CHOICE%"=="3" set "ACTION=stop"
if "%CHOICE%"=="4" set "ACTION=status"
if "%CHOICE%"=="5" exit /b 0
if "%ACTION%"=="" goto prompt

:dispatch
set "VALID_ACTION="
if /I "%ACTION%"=="start"    set VALID_ACTION=1& call :do_start
if /I "%ACTION%"=="iniciar"  set VALID_ACTION=1& call :do_start
if /I "%ACTION%"=="restart"  set VALID_ACTION=1& call :do_restart
if /I "%ACTION%"=="reiniciar" set VALID_ACTION=1& call :do_restart
if /I "%ACTION%"=="stop"     set VALID_ACTION=1& call :do_stop
if /I "%ACTION%"=="parar"    set VALID_ACTION=1& call :do_stop
if /I "%ACTION%"=="kill"     set VALID_ACTION=1& call :do_stop
if /I "%ACTION%"=="matar"    set VALID_ACTION=1& call :do_stop
if /I "%ACTION%"=="status"   set VALID_ACTION=1& call :do_status

if not defined VALID_ACTION (
    echo Acao invalida: %ACTION%
)

if defined INTERACTIVE (
    echo.
    pause
    set "ACTION="
    goto prompt
)
exit /b 0


:: ====================================================
:: SUB-ROTINAS
:: ====================================================

:do_status
set "PID="
if exist "%PIDFILE%" (
    for /f "usebackq delims=" %%p in ("%PIDFILE%") do set "PID=%%p"
)
if defined PID (
    tasklist /FI "PID eq %PID%" /NH 2>nul | findstr /I "%PID%" >nul
    if errorlevel 1 set "PID="
)
if not defined PID (
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":%PORT% " ^| findstr "LISTENING"') do set "PID=%%p"
)
if not defined PID (
    echo Dashboard: PARADO
    exit /b 0
)
echo Dashboard: RODANDO PID %PID% em http://localhost:%PORT%
exit /b 0

:do_stop
echo ===== %date% %time% ===== >> "%INITLOG%"
echo INICIA: parando dashboard >> "%INITLOG%"

set "KILLED_ANY="

:: 1. Tenta matar pelo PIDFILE
set "FILE_PID="
if exist "%PIDFILE%" (
    for /f "usebackq delims=" %%p in ("%PIDFILE%") do set "FILE_PID=%%p"
)
if defined FILE_PID (
    :: Remove possiveis espacos
    for %%A in (%FILE_PID%) do set "FILE_PID=%%A"
    echo INICIA: encerrando PID do arquivo !FILE_PID! >> "%INITLOG%"
    taskkill /PID !FILE_PID! /T /F >> "%INITLOG%" 2>&1
    set "KILLED_ANY=1"
    if exist "%PIDFILE%" del /f /q "%PIDFILE%" >nul 2>&1
)

:: 2. Tenta matar qualquer processo ouvindo na porta
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":%PORT% " ^| findstr "LISTENING"') do (
    echo INICIA: encerrando PID %%p na porta %PORT% >> "%INITLOG%"
    taskkill /PID %%p /T /F >> "%INITLOG%" 2>&1
    set "KILLED_ANY=1"
)

if not defined KILLED_ANY (
    echo Dashboard: PARADO
    exit /b 0
)

:: Aguarda os processos encerrarem
timeout /t 2 >nul

:: 3. Verifica se ainda tem alguem na porta
set "STILL_RUNNING="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":%PORT% " ^| findstr "LISTENING"') do set "STILL_RUNNING=%%p"

if defined STILL_RUNNING (
    echo INICIA: falha ao encerrar PID %STILL_RUNNING% na porta %PORT%. >> "%INITLOG%"
    echo Dashboard: AINDA RODANDO porta %PORT% ^(PID %STILL_RUNNING%^)
    exit /b 1
)

echo Dashboard: PARADO
exit /b 0

:do_restart
call :do_stop
if errorlevel 1 (
    echo Erro ao parar o servidor. Reinicializacao abortada.
    exit /b 1
)
call :do_start
exit /b 0

:do_start
echo ===== %date% %time% ===== >> "%INITLOG%"
echo INICIA: iniciando dashboard >> "%INITLOG%"

:: Verifica se ja esta rodando
set "PID="
if exist "%PIDFILE%" (
    for /f "usebackq delims=" %%p in ("%PIDFILE%") do set "PID=%%p"
)
if defined PID (
    tasklist /FI "PID eq %PID%" /NH 2>nul | findstr /I "%PID%" >nul
    if errorlevel 1 set "PID="
)
if not defined PID (
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":%PORT% " ^| findstr "LISTENING"') do set "PID=%%p"
)
if defined PID (
    echo Dashboard: JA ESTA RODANDO PID %PID% em http://localhost:%PORT%
    exit /b 0
)

if exist "%PIDFILE%" del /f /q "%PIDFILE%" >nul 2>&1

where npm >nul 2>nul
if errorlevel 1 (
    echo ERRO: npm nao encontrado. Verifique se o Node.js esta instalado e no PATH.
    exit /b 1
)

pushd "%DASH%"
if not exist "node_modules" (
    echo INICIA: node_modules ausente, rodando npm install >> "%INITLOG%"
    call npm install >> "%INITLOG%" 2>&1
    if errorlevel 1 (
        echo ERRO: Falha no npm install. Veja o log em %INITLOG%
        popd
        exit /b 1
    )
)

echo INICIA: executando npm run build >> "%INITLOG%"
call npm run build >> "%INITLOG%" 2>&1
if errorlevel 1 (
    echo ERRO: Falha no npm run build. Veja o log em %INITLOG%
    popd
    exit /b 1
)

:: Inicia o servidor em background (completamente desanexado da janela atual)
echo INICIA: iniciando processo em background (hidden)... >> "%INITLOG%"

:: Cria um script intermediario para o Node (assim nao precisamos escapar VBScript)
set "RUN_BAT=%DASH%\.run.bat"
> "!RUN_BAT!" echo @echo off
>> "!RUN_BAT!" echo set PORT=%PORT%
>> "!RUN_BAT!" echo set HOSTNAME=127.0.0.1
>> "!RUN_BAT!" echo npm run start:optimized ^> "%SERVERLOG%" 2^>^&1

:: Cria o VBScript limpo apenas para ocultar o .run.bat
set "VBSFILE=%DASH%\.hidden.vbs"
> "!VBSFILE!" echo Set WshShell = CreateObject^("WScript.Shell"^)
>> "!VBSFILE!" echo WshShell.Run """%RUN_BAT%""", 0, False

cscript //nologo "!VBSFILE!"
timeout /t 1 /nobreak >nul
del /f /q "!VBSFILE!" >nul 2>&1
del /f /q "!RUN_BAT!" >nul 2>&1
popd

:: Aguarda o processo comecar a escutar
echo Aguardando inicializacao...
timeout /t 5 /nobreak >nul

:: Captura o PID do processo na porta %PORT%
set "PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":%PORT% " ^| findstr "LISTENING"') do (
    set "PID=%%p"
    goto :found
)
:found
if not defined PID (
    echo ERRO: Nao foi possivel encontrar o processo na porta %PORT%.
    echo Verifique o log em %SERVERLOG%
    exit /b 1
)

> "%PIDFILE%" echo %PID%
echo INICIA: processo encontrado com PID %PID% >> "%INITLOG%"

:: Aguarda o servidor responder via HTTP
set "READY="
for /l %%i in (1,1,20) do (
    timeout /t 1 /nobreak >nul
    curl -s -o nul -w "%%{http_code}" http://127.0.0.1:%PORT%/login 2>nul | findstr /r "^[23]" >nul
    if not errorlevel 1 (
        set "READY=1"
        goto :started
    )
)
:started
if "%READY%"=="1" (
    echo Dashboard: RODANDO em background ^(PID %PID%^) - http://localhost:%PORT%
    echo INICIA: servidor pronto >> "%INITLOG%"
) else (
    echo Aviso: servidor pode nao ter iniciado completamente. Verifique %SERVERLOG%
    echo INICIA: timeout de espera >> "%INITLOG%"
)

exit /b 0
