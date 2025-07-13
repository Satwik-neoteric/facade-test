@echo off
echo Testing build...
dotnet build
if %ERRORLEVEL% == 0 (
  echo Build successful!
) else (
  echo Build failed with errors.
)
pause
