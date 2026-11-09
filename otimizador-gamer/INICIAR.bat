@echo off
title Otimizador Gamer
echo.
echo  Abrindo o Otimizador Gamer...
echo  Clique em "Sim" quando o Windows pedir permissao de administrador.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0app\OtimizadorGamer.ps1"
if errorlevel 1 (
  echo.
  echo  Nao foi possivel abrir o programa.
  echo  Tente: clique com o botao direito no INICIAR.bat e escolha "Executar como administrador".
  echo.
  pause
)
