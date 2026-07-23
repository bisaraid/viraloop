@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d c:\APP\viraloop-js\viraloop
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm