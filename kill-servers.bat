@echo off
echo Deteniendo servidores RojoPlus...

:: Matar proceso en puerto 3001 (backend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Matando backend PID: %%a
    taskkill /F /PID %%a
)

:: Matar proceso en puerto 5173 (frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    echo Matando frontend PID: %%a
    taskkill /F /PID %%a
)

echo Servidores detenidos.
pause
