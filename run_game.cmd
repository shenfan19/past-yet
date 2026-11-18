@echo off
rem Serve this folder, then open http://127.0.0.1:8778/index.html
python -m http.server 8778 --bind 127.0.0.1
