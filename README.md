# Utility Maintenance Control Tower Demo

This project delivers an interactive control tower experience for utility operations teams.
It pairs a FastAPI backend with a React + Material UI frontend and a simulated, map-like
visualization to highlight asset health, risk prioritization, spares coverage, and crew
activity without depending on external mapping providers.

## Getting started

1. Create and activate a virtual environment, then install the backend dependencies:

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Launch the FastAPI application:

   ```bash
   uvicorn app.main:app --reload
   ```

3. Visit [http://localhost:8000](http://localhost:8000) to open the control tower dashboard.
   The frontend is bundled directly in the `frontend/` directory and is served as static files
   by FastAPI, so no additional build tooling is required.

## Demo features

- **Simulated operational map** – an SVG-based workspace supports panning, zooming, and animated
  markers that mimic an interactive map without external basemap APIs.
- **Asset insights** – color-coded asset markers, detail dialogs, and floating panels summarize
  equipment status, health distribution, and the highest-risk assets to inspect next.
- **Crew visibility** – crew locations, task queues, and illustrative travel paths show how field
  teams are positioned relative to critical work.
- **Refreshable scenarios** – use the "Refresh data" button to regenerate randomized operational
  data via the FastAPI `/api/refresh` endpoint, making it easy to demonstrate different conditions
  during a session.

## Backend data model

The backend exposes lightweight simulation endpoints that return randomized asset, crew, and depot
snapshots. The primary routes are:

- `GET /api/dashboard` – returns the current generated snapshot used by the dashboard.
- `POST /api/refresh` – regenerates the snapshot and returns the latest data.
- `GET /api/assets`, `/api/crews`, `/api/spares`, `/api/priorities`, `/api/failures`, `/api/routes`
  – individual slices of the snapshot for integrations or debugging.

Each response includes pseudo map coordinates (`x`, `y` within a 1000x700 grid) so the frontend can
position assets and crews inside the simulated workspace.

## Frontend architecture

The dashboard is implemented with React 18 and Material UI components loaded from CDN sources.
All logic lives in `frontend/app.js` (transpiled in-browser via Babel) and renders a responsive
layout featuring:

- A top navigation bar with global status indicators and a manual refresh button.
- A collapsible filter sidebar summarizing asset categories.
- A central simulated map augmented with floating insight panels for assets, risk, and crews.

Because the UI uses standard HTML/CSS/JavaScript and CDN-hosted React/MUI bundles, it runs anywhere
FastAPI can serve static files—ideal for lightweight demos and GitHub Codespaces environments.
