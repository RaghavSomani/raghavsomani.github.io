# raghavsomani.github.io

Source for [Raghav Somani's personal website](https://raghavsomani.github.io/), including research projects, publications, technical notes, and a curriculum vitae.

## Local development

The site is built with Jekyll and the GitHub Pages dependency set.

1. Install Ruby, Bundler, and Node.js 18 or newer.
2. Run `bundle install`.
3. Run `bundle exec jekyll serve`.
4. Open `http://localhost:4000`.

On this Windows workstation, run `serve-local.bat` to start the WSL-based development server with live reload. Keep its terminal open while reviewing the site and press Ctrl+C when finished.

Run `run.bat` on Windows for a production build, an internal-link check, and a concise Git status. The script deliberately does not stage, commit, or push changes.

If the browser JavaScript sources are changed, rebuild `assets/js/main.min.js` with `npm run build:js` before committing.

## Content

- `_pages/` contains top-level pages.
- `_posts/` contains technical notes.
- `_projects/` contains project pages.
- `_publications/` contains publication pages and metadata.
- `_data/navigation.yml` controls the primary navigation.
- `_config.yml` contains site-wide identity, metadata, and collection settings.

Pull requests run a pinned Jekyll build plus internal-link and structural HTML checks through `.github/workflows/site-checks.yml`.

## Theme attribution

The site is based on [AcademicPages](https://github.com/academicpages/academicpages.github.io), which derives from [Minimal Mistakes](https://github.com/mmistakes/minimal-mistakes). See `LICENSE` for licensing information.
