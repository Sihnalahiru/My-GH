# BUILD-16 — GitHub Pages Deployment

## Deployment target

This project is designed for a GitHub repository named:

`SSW-AIRPORT-GROUND-HANDLING-PWA`

Expected Pages URL:

`https://<github-username>.github.io/SSW-AIRPORT-GROUND-HANDLING-PWA/`

## Deployment method

GitHub Actions + GitHub Pages.

Workflow:

`.github/workflows/pages.yml`

The workflow deploys the repository root as the Pages artifact.

## Required GitHub setting

Repository → Settings → Pages → Build and deployment:

- Source: **GitHub Actions**

No `gh-pages` branch is required by this workflow.

## Important path rule

The PWA uses relative paths (`./...`) for the app shell, data, scripts, manifest and service worker. This is required for a repository/project Pages deployment where the site is served below:

`/<repository-name>/`

Do not convert these paths to root-absolute paths such as `/index.html`, `/data/...`, or `/sw.js`.

## Service Worker / PWA scope

The service worker is located at:

`/sw.js`

When deployed at the repository root, its default scope covers the deployed project path.

## External official resources

Official JAEA/IRODORI-style external resources must remain online-first and source-verified. Do not copy large official PDFs/MP3s/images into the GitHub repository merely for deployment.

## Final deployment sequence

1. Create/open the GitHub repository.
2. Put the cumulative project files at repository root.
3. Commit and push to `main`.
4. Enable Pages with **GitHub Actions** if required.
5. Wait for the `Deploy PWA to GitHub Pages` workflow.
6. Open the generated Pages URL.
7. Run the final post-deployment QA:
   - PWA loads
   - manifest loads
   - service worker registers
   - offline shell opens
   - data JSON loads
   - navigation works
   - official external resources load when online
   - no mixed-content errors
   - mobile installation works

## Important limitation

BUILD-16 validates the deployment architecture and workflow configuration. It cannot honestly claim that the live GitHub repository has been deployed or that the live URL works until the repository is actually pushed and the GitHub Actions workflow runs.
