
pyinstaller -F processStatus.py
pause

pyinstaller build.spec
pause

pyinstaller processStatus.py
pause
