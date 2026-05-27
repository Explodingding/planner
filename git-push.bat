@echo off
cd /d "%~dp0"

echo === Removing stale git lock ===
if exist ".git\index.lock" (
    del /f ".git\index.lock"
    echo Lock removed.
) else (
    echo No lock found.
)

echo.
echo === Git status ===
git status --short

echo.
echo === Adding all changes ===
git add -A

echo.
echo === Committing ===
git commit -m "SEO: og:image + JSON-LD; animations; partner links; WhatsApp import"

echo.
echo === Pushing to GitHub ===
git push

echo.
echo === Done! Press any key to close ===
pause
