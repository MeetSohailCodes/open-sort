# Contributing to Archivist

Thanks for taking the time to contribute. This project welcomes bug reports, feature requests, and PRs.

## Quick Guidelines
- Open an issue first for larger changes so we can align on scope.
- Keep PRs focused and small when possible.
- Follow the existing code style and naming patterns.
- Avoid touching unrelated files.

## Local Setup
1) Install root dependencies: `npm install`
2) Install frontend deps: `cd frontend && npm install`
3) Install backend deps: `python -m venv backend/venv` then `backend/venv/Scripts/pip install -r backend/requirements.txt`

## Running Locally
- Backend: `python backend/main.py`
- Frontend: `cd frontend && npm run dev`

## Submitting a PR
- Describe what changed and why.
- Include screenshots for UI changes when possible.
- Make sure the app still builds: `cd frontend && npm run build`

## Code of Conduct
By participating, you agree to follow `CODE_OF_CONDUCT.md`.
