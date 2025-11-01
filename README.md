# Utility Maintenance Control Tower Demo

This project provides an interactive control tower experience for utility operations teams.
It combines a FastAPI backend with a Mappls-powered frontend to showcase asset health, spares
availability, predicted failures, risk-based prioritization, and crew routing.

## Getting started

1. Provision a [Mappls (MapmyIndia) API key](https://about.mappls.com/api/index.php#api-stack) and set it
   as an environment variable before starting the app:

   ```bash
   export MAPPLS_API_KEY="your_mappls_key_here"
   ```

2. Install dependencies and launch the FastAPI server:

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

Then open [http://localhost:8000](http://localhost:8000) to explore the dashboard. If the API key is
missing or incorrect the map panel will surface a troubleshooting message.

## Features

- **Asset health visualization** – color-coded markers display real-time conditions and service windows.
- **Spares availability** – depot markers call out projected shortages and inventory levels.
- **Predicted failures** – red risk zones highlight assets with elevated probability of failure.
- **Risk-based prioritization** – ranked list of assets to address next based on risk scores.
- **Crew scheduling & routing** – crew locations, assignments, and optimized routes rendered on the map.

The data powering the dashboard is scenario-based so it can be adapted or extended for demos.
