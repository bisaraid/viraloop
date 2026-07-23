@echo off
echo Menambahkan Node.js ke system PATH permanen...
echo.
setx PATH "C:\Program Files\nodejs;%PATH%" /M
echo.
echo Selesai! Tutup dan buka ulang terminal untuk efek.
echo Coba ketik: node --version
pause