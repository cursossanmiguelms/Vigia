@echo off
chcp 65001 >nul
title VigIA - Deteccion local
cd /d "%~dp0"

where python >nul 2>nul
set "PYTHON=python"
if exist ".venv\Scripts\python.exe" set "PYTHON=.venv\Scripts\python.exe"

if not exist ".venv\Scripts\python.exe" (
  where python >nul 2>nul
  if errorlevel 1 (
    echo.
    echo ERROR: no se encontro Python en el PATH.
    echo Instala Python desde https://www.python.org/ y vuelve a intentarlo.
    echo.
    pause
    exit /b 1
  )
)

netstat -ano | findstr ":8000" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo ERROR: el puerto 8000 ya esta en uso.
  echo Cierra la ventana negra anterior de VigIA y vuelve a ejecutar run.bat.
  echo Si el problema sigue, reinicia la PC o ejecuta: python server.py 8080
  echo.
  pause
  exit /b 1
)

echo.
echo Iniciando VigIA...
echo.
echo La pagina se abrira en: http://localhost:8000
echo Si no se abre, copia esa direccion en tu navegador.
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8000"

"%PYTHON%" server.py

echo.
echo El servidor se detuvo.
pause
