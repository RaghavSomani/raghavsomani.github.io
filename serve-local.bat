@echo off
setlocal

echo Starting the local site at http://localhost:4000/
echo Keep this window open while reviewing. Press Ctrl+C to stop.

wsl -d Ubuntu --cd "%~dp0" -- bash -lc "BUNDLE_PATH=.bundle/vendor BUNDLE_FROZEN=true bundle exec jekyll serve --host localhost --port 4000 --livereload --force_polling"
if errorlevel 1 (
  echo.
  echo The local server stopped with an error.
  pause
)
