@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d c:\APP\ViraLoop
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm