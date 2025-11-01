# Utility Maintenance Control Tower Demo

This project delivers an interactive control tower experience for utility operations teams.
It pairs a FastAPI backend with a handcrafted HTML/CSS/JavaScript frontend and a simulated
map-like visualization to highlight asset health, risk prioritization, spares coverage, and
crew activity without depending on external mapping or UI frameworks.

## Getting started

1. Create and activate a virtual environment, then install the backend dependencies:

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Launch the FastAPI application (the host/port flags keep it friendly for GitHub Codespaces):

   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

3. Visit [http://localhost:8000](http://localhost:8000) to open the control tower dashboard.
   The frontend ships directly in the `frontend/` directory and is served as static files by
   FastAPI—no additional build tooling or CDN-hosted libraries are required.

## Demo features

- **Simulated operational map** – a CSS-powered grid workspace supports panning, scroll-wheel zoom,
  and animated markers that mimic an interactive map without external basemap APIs.
- **Asset insights** – color-coded asset markers, detail popovers, and floating panels summarize
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

The dashboard is implemented with modern, framework-free JavaScript contained in `frontend/app.js`.
Styling lives in `frontend/styles.css` and uses CSS variables, gradients, glassmorphism, and smooth
transitions to create a polished look while staying self-contained. The HTML structure in
`frontend/index.html` provides the navigation shell, map canvas, and insight panels. All data is
fetched from the FastAPI endpoints above, and the simulated map supports panning, zooming, marker
animations, and popovers entirely on the client side.

## Codespaces tip

If you are running in GitHub Codespaces, forward port `8000` and open the forwarded URL to view the
dashboard. Because the UI is built without external CDNs, it works even when outbound network
access is restricted.
