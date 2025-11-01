from __future__ import annotations

import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "frontend"

app = FastAPI(title="Utility Maintenance Control Tower")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

MAPPLS_API_KEY = os.getenv("MAPPLS_API_KEY")

NOW = datetime(2024, 5, 15, 9, 30)

ASSETS: List[Dict[str, object]] = [
    {
        "id": "TX-01",
        "name": "North Substation Transformer",
        "type": "Transformer",
        "lat": 40.7683,
        "lng": -73.9818,
        "health_score": 86,
        "risk_score": 24,
        "status": "Good",
        "last_service": NOW - timedelta(days=120),
        "next_service": NOW + timedelta(days=60),
    },
    {
        "id": "SW-12",
        "name": "Riverside Switchgear",
        "type": "Switchgear",
        "lat": 40.7428,
        "lng": -74.003,
        "health_score": 62,
        "risk_score": 48,
        "status": "Fair",
        "last_service": NOW - timedelta(days=210),
        "next_service": NOW + timedelta(days=21),
    },
    {
        "id": "LINE-07",
        "name": "Queens Feeder Line",
        "type": "Feeder Line",
        "lat": 40.73061,
        "lng": -73.935242,
        "health_score": 54,
        "risk_score": 67,
        "status": "At Risk",
        "last_service": NOW - timedelta(days=300),
        "next_service": NOW + timedelta(days=7),
    },
    {
        "id": "CAP-03",
        "name": "Bronx Capacitor Bank",
        "type": "Capacitor",
        "lat": 40.8484,
        "lng": -73.9339,
        "health_score": 38,
        "risk_score": 82,
        "status": "Critical",
        "last_service": NOW - timedelta(days=420),
        "next_service": NOW + timedelta(days=3),
    },
    {
        "id": "DER-02",
        "name": "Brooklyn Solar Inverter",
        "type": "Inverter",
        "lat": 40.6782,
        "lng": -73.9442,
        "health_score": 91,
        "risk_score": 12,
        "status": "Excellent",
        "last_service": NOW - timedelta(days=75),
        "next_service": NOW + timedelta(days=90),
    },
]

SPARE_DEPOTS: List[Dict[str, object]] = [
    {
        "id": "DEP-A",
        "name": "Long Island City Depot",
        "lat": 40.744,
        "lng": -73.948,
        "inventory": {
            "transformer_bushings": 12,
            "switchgear_relays": 8,
            "feeder_splice_kits": 20,
        },
        "projected_demand": {
            "transformer_bushings": 10,
            "switchgear_relays": 11,
            "feeder_splice_kits": 14,
        },
    },
    {
        "id": "DEP-B",
        "name": "Hoboken Depot",
        "lat": 40.7433,
        "lng": -74.0324,
        "inventory": {
            "capacitor_modules": 5,
            "breaker_units": 6,
            "pole_transformers": 3,
        },
        "projected_demand": {
            "capacitor_modules": 9,
            "breaker_units": 4,
            "pole_transformers": 5,
        },
    },
]

CREWS: List[Dict[str, object]] = [
    {
        "id": "CR-01",
        "name": "Queens Reliability Crew",
        "lat": 40.7497,
        "lng": -73.8623,
        "status": "En route",
        "shift_end": NOW + timedelta(hours=6, minutes=30),
        "next_tasks": [
            {
                "asset_id": "LINE-07",
                "eta": NOW + timedelta(hours=1, minutes=45),
                "task": "Thermal inspection & line clearance",
            },
            {
                "asset_id": "TX-01",
                "eta": NOW + timedelta(hours=4),
                "task": "Oil quality sampling",
            },
        ],
    },
    {
        "id": "CR-02",
        "name": "Grid Modernization Crew",
        "lat": 40.7128,
        "lng": -73.99,
        "status": "On site",
        "shift_end": NOW + timedelta(hours=4, minutes=15),
        "next_tasks": [
            {
                "asset_id": "SW-12",
                "eta": NOW + timedelta(minutes=20),
                "task": "Breaker relay retrofit",
            }
        ],
    },
]

CREW_ROUTES: Dict[str, List[List[float]]] = {
    "CR-01": [
        [40.7497, -73.8623],
        [40.7397, -73.89],
        [40.73061, -73.935242],
        [40.7683, -73.9818],
    ],
    "CR-02": [
        [40.7128, -73.99],
        [40.7188, -73.995],
        [40.7428, -74.003],
    ],
}

FAILURE_PREDICTIONS: List[Dict[str, object]] = [
    {
        "asset_id": "LINE-07",
        "likelihood": 0.78,
        "window_hours": 48,
        "drivers": ["Elevated conductor temperature", "Storm impact risk"],
    },
    {
        "asset_id": "CAP-03",
        "likelihood": 0.86,
        "window_hours": 24,
        "drivers": ["Capacitance drift", "Insulation degradation"],
    },
]


@app.get("/")
async def root() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/assets")
async def get_assets() -> List[Dict[str, object]]:
    formatted = []
    for asset in ASSETS:
        formatted.append(
            {
                **asset,
                "last_service": asset["last_service"].isoformat(),
                "next_service": asset["next_service"].isoformat(),
            }
        )
    return formatted


@app.get("/api/spares")
async def get_spares() -> List[Dict[str, object]]:
    return SPARE_DEPOTS


@app.get("/api/failures")
async def get_failures() -> List[Dict[str, object]]:
    return FAILURE_PREDICTIONS


@app.get("/api/priorities")
async def get_priorities() -> List[Dict[str, object]]:
    ranked = sorted(ASSETS, key=lambda asset: asset["risk_score"], reverse=True)
    priorities: List[Dict[str, object]] = []
    for rank, asset in enumerate(ranked, start=1):
        priorities.append(
            {
                "rank": rank,
                "asset_id": asset["id"],
                "name": asset["name"],
                "risk_score": asset["risk_score"],
                "status": asset["status"],
                "next_service": asset["next_service"].isoformat(),
            }
        )
    return priorities


@app.get("/api/crews")
async def get_crews() -> List[Dict[str, object]]:
    payload: List[Dict[str, object]] = []
    for crew in CREWS:
        payload.append(
            {
                **crew,
                "shift_end": crew["shift_end"].isoformat(),
                "next_tasks": [
                    {
                        **task,
                        "eta": task["eta"].isoformat(),
                    }
                    for task in crew["next_tasks"]
                ],
            }
        )
    return payload


@app.get("/api/routes")
async def get_routes() -> Dict[str, List[List[float]]]:
    return CREW_ROUTES


@app.get("/api/config")
async def get_config() -> Dict[str, object]:
    """Expose configuration required by the frontend."""

    return {"mapplsKey": MAPPLS_API_KEY}
