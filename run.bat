@echo off
setlocal

bundle exec jekyll build --trace
if errorlevel 1 (
  echo Site build failed. Nothing was staged or pushed.
  exit /b 1
)

npm run check:links
if errorlevel 1 (
  echo Internal link check failed. Nothing was staged or pushed.
  exit /b 1
)

git status --short
echo Site build completed successfully. Review the changes before committing.
pause
