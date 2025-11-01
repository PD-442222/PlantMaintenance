# Utility Maintenance Control Tower Demo

This project provides an interactive control tower experience for utility operations teams.
It combines a FastAPI backend with a lightweight Leaflet-powered frontend to showcase
asset health, spares availability, predicted failures, risk-based prioritization, and crew routing.

## Getting started

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Then open [http://localhost:8000](http://localhost:8000) to explore the dashboard.

## Features

- **Asset health visualization** – color-coded markers display real-time conditions and service windows.
- **Spares availability** – depot markers call out projected shortages and inventory levels.
- **Predicted failures** – red risk zones highlight assets with elevated probability of failure.
- **Risk-based prioritization** – ranked list of assets to address next based on risk scores.
- **Crew scheduling & routing** – crew locations, assignments, and optimized routes rendered on the map.

The data powering the dashboard is scenario-based so it can be adapted or extended for demos.
