@echo off
cd /d "%~dp0"
"C:\Program Files\nodejs\npm.cmd" install smiles-drawer
echo EXIT_CODE=%ERRORLEVEL%
