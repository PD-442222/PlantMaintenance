from __future__ import annotations

import random
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

ASSET_TYPES = [
    "Substation Transformer",
    "Feeder Line",
    "Switchgear",
    "Capacitor Bank",
    "Recloser",
    "Solar Inverter",
]
HEALTH_STATES = ["Excellent", "Good", "Warning", "Critical"]
CREW_NAMES = [
    "Reliability Crew",
    "Grid Modernization",
    "Storm Response",
    "Asset Performance",
]
REGIONS = ["North", "South", "East", "West", "Central"]
PARTS = [
    "transformer_bushings",
    "switchgear_relays",
    "feeder_splice_kits",
    "capacitor_modules",
    "breaker_units",
]

SNAPSHOT: Dict[str, object] = {}


def _bounded_point() -> Dict[str, int]:
    """Return a pseudo-map coordinate within a 1000x700 grid."""

    return {"x": random.randint(60, 940), "y": random.randint(70, 630)}


def _generate_assets(count: int = 12) -> List[Dict[str, object]]:
    now = datetime.utcnow()
    assets: List[Dict[str, object]] = []
    for idx in range(1, count + 1):
        asset_type = random.choice(ASSET_TYPES)
        status = random.choices(
            HEALTH_STATES, weights=[0.25, 0.4, 0.25, 0.1], k=1
        )[0]
        health_score = {
            "Excellent": random.randint(90, 100),
            "Good": random.randint(75, 89),
            "Warning": random.randint(55, 74),
            "Critical": random.randint(30, 54),
        }[status]
        risk_score = 100 - health_score + random.randint(0, 10)
        since_service = random.randint(14, 360)
        next_service = random.randint(7, 120)
        coords = _bounded_point()
        assets.append(
            {
                "id": f"AST-{idx:03d}",
                "name": f"{random.choice(REGIONS)} {asset_type}",
                "type": asset_type,
                "region": random.choice(REGIONS),
                "status": status,
                "health_score": health_score,
                "risk_score": risk_score,
                "x": coords["x"],
                "y": coords["y"],
                "last_service": (now - timedelta(days=since_service)).isoformat(),
                "next_service": (now + timedelta(days=next_service)).isoformat(),
            }
        )
    return assets


def _generate_spares() -> List[Dict[str, object]]:
    depots: List[Dict[str, object]] = []
    for idx, region in enumerate(random.sample(REGIONS, k=3), start=1):
        inventory = {part: random.randint(2, 25) for part in PARTS}
        demand = {part: max(0, qty - random.randint(-3, 6)) for part, qty in inventory.items()}
        coords = _bounded_point()
        depots.append(
            {
                "id": f"DEP-{idx:02d}",
                "name": f"{region} Logistics Hub",
                "region": region,
                "x": coords["x"],
                "y": coords["y"],
                "inventory": inventory,
                "projected_demand": demand,
            }
        )
    return depots


def _generate_crews(assets: List[Dict[str, object]]) -> List[Dict[str, object]]:
    crews: List[Dict[str, object]] = []
    now = datetime.utcnow()
    for idx, name in enumerate(random.sample(CREW_NAMES, k=3), start=1):
        coords = _bounded_point()
        assigned_assets = random.sample(assets, k=2)
        crews.append(
            {
                "id": f"CR-{idx:02d}",
                "name": f"{assigned_assets[0]['region']} {name}",
                "status": random.choice(["On site", "En route", "Standby"]),
                "x": coords["x"],
                "y": coords["y"],
                "shift_end": (now + timedelta(hours=random.randint(2, 8))).isoformat(),
                "next_tasks": [
                    {
                        "asset_id": asset["id"],
                        "asset_name": asset["name"],
                        "eta": (now + timedelta(minutes=random.randint(15, 120))).isoformat(),
                        "task": random.choice(
                            [
                                "Infrared inspection",
                                "Oil analysis",
                                "Breaker calibration",
                                "Vegetation management",
                                "Firmware update",
                            ]
                        ),
                    }
                    for asset in assigned_assets
                ],
            }
        )
    return crews


def _generate_routes(crews: List[Dict[str, object]]) -> Dict[str, List[Dict[str, int]]]:
    routes: Dict[str, List[Dict[str, int]]] = {}
    for crew in crews:
        waypoints: List[Dict[str, int]] = []
        last_point = {"x": crew["x"], "y": crew["y"]}
        for _ in range(3):
            jitter = {"x": last_point["x"] + random.randint(-90, 90), "y": last_point["y"] + random.randint(-90, 90)}
            jitter["x"] = max(40, min(960, jitter["x"]))
            jitter["y"] = max(50, min(650, jitter["y"]))
            waypoints.append(jitter)
            last_point = jitter
        routes[crew["id"]] = waypoints
    return routes


def _generate_failures(assets: List[Dict[str, object]]) -> List[Dict[str, object]]:
    risky_assets = sorted(assets, key=lambda item: item["risk_score"], reverse=True)[:4]
    failures: List[Dict[str, object]] = []
    for asset in risky_assets:
        failures.append(
            {
                "asset_id": asset["id"],
                "asset_name": asset["name"],
                "likelihood": round(random.uniform(0.55, 0.92), 2),
                "window_hours": random.choice([12, 24, 36, 48, 72]),
                "drivers": random.sample(
                    [
                        "Thermal variance",
                        "Load imbalance",
                        "Moisture ingress",
                        "Vibration signature",
                        "Corrosion indicators",
                    ],
                    k=2,
                ),
            }
        )
    return failures


def refresh_data() -> Dict[str, object]:
    global SNAPSHOT
    assets = _generate_assets()
    spares = _generate_spares()
    crews = _generate_crews(assets)
    routes = _generate_routes(crews)
    failures = _generate_failures(assets)
    priorities = sorted(
        (
            {
                "rank": idx + 1,
                "asset_id": asset["id"],
                "name": asset["name"],
                "risk_score": asset["risk_score"],
                "status": asset["status"],
                "next_service": asset["next_service"],
            }
            for idx, asset in enumerate(sorted(assets, key=lambda item: item["risk_score"], reverse=True))
        ),
        key=lambda item: item["rank"],
    )
    snapshot = {
        "generated_at": datetime.utcnow().isoformat(),
        "assets": assets,
        "spares": spares,
        "crews": crews,
        "routes": routes,
        "failures": failures,
        "priorities": priorities,
    }
    SNAPSHOT = snapshot
    return snapshot


# Prime the snapshot used by all endpoints.
refresh_data()


@app.get("/")
async def root() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/dashboard")
async def get_dashboard() -> Dict[str, object]:
    return SNAPSHOT


@app.post("/api/refresh")
async def post_refresh() -> Dict[str, object]:
    return refresh_data()


@app.get("/api/assets")
async def get_assets() -> List[Dict[str, object]]:
    return SNAPSHOT["assets"]


@app.get("/api/spares")
async def get_spares() -> List[Dict[str, object]]:
    return SNAPSHOT["spares"]


@app.get("/api/failures")
async def get_failures() -> List[Dict[str, object]]:
    return SNAPSHOT["failures"]


@app.get("/api/priorities")
async def get_priorities() -> List[Dict[str, object]]:
    return SNAPSHOT["priorities"]


@app.get("/api/crews")
async def get_crews() -> List[Dict[str, object]]:
    return SNAPSHOT["crews"]


@app.get("/api/routes")
async def get_routes() -> Dict[str, List[Dict[str, int]]]:
    return SNAPSHOT["routes"]
