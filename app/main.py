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
HEALTH_STATES = ["Healthy", "Warning", "Critical"]
CRITICALITY_LEVELS = ["Low", "Medium", "High"]
CREW_NAMES = [
    "Reliability Crew",
    "Grid Modernization",
    "Storm Response",
    "Asset Performance",
]
REGIONS = ["North", "South", "East", "West", "Central"]
PARTS = [
    "Transformer Bushings",
    "Switchgear Relays",
    "Feeder Splice Kits",
    "Capacitor Modules",
    "Breaker Units",
]
POTENTIAL_FAILURE_DRIVERS = [
    "Thermal variance",
    "Load imbalance",
    "Moisture ingress",
    "Vibration signature",
    "Corrosion indicators",
    "Insulation breakdown",
]
RESOLUTION_FINDINGS = [
    "Voltage spikes linked to relay chatter",
    "Seasonal load growth stressing feeders",
    "Oil contaminants increasing transformer wear",
    "Breaker trips correlated with capacitor drift",
    "Wind-driven debris causing hotspot alarms",
]

SNAPSHOT: Dict[str, object] = {}


def _bounded_point() -> Dict[str, int]:
    """Return pseudo-map coordinates within a 1000x700 grid."""

    return {"x": random.randint(60, 940), "y": random.randint(70, 630)}


def _choose_criticality(status: str) -> str:
    if status == "Critical":
        weights = [0.1, 0.35, 0.55]
    elif status == "Warning":
        weights = [0.2, 0.55, 0.25]
    else:  # Healthy
        weights = [0.6, 0.3, 0.1]
    return random.choices(CRITICALITY_LEVELS, weights=weights, k=1)[0]


def _maintenance_cost(asset_type: str, criticality: str) -> int:
    base = {
        "Substation Transformer": 42000,
        "Feeder Line": 12000,
        "Switchgear": 18000,
        "Capacitor Bank": 9000,
        "Recloser": 14000,
        "Solar Inverter": 15000,
    }.get(asset_type, 10000)
    modifier = {"Low": 0.75, "Medium": 1.0, "High": 1.3}[criticality]
    return int(base * modifier + random.randint(-2500, 2500))


def _generate_assets(count: int = 14) -> List[Dict[str, object]]:
    now = datetime.utcnow()
    assets: List[Dict[str, object]] = []
    for idx in range(1, count + 1):
        asset_type = random.choice(ASSET_TYPES)
        status = random.choices(HEALTH_STATES, weights=[0.55, 0.3, 0.15], k=1)[0]
        health_score = {
            "Healthy": random.randint(82, 100),
            "Warning": random.randint(55, 81),
            "Critical": random.randint(30, 54),
        }[status]
        criticality = _choose_criticality(status)
        maintenance_cost = _maintenance_cost(asset_type, criticality)
        risk_score = 100 - health_score + {"Low": 5, "Medium": 12, "High": 20}[criticality]
        coords = _bounded_point()
        maintenance_window = random.choice([12, 24, 36, 48, 72])
        since_service = random.randint(30, 365)
        next_service = random.randint(7, 120)
        assets.append(
            {
                "id": f"AST-{idx:03d}",
                "name": f"{random.choice(REGIONS)} {asset_type}",
                "type": asset_type,
                "region": random.choice(REGIONS),
                "status": status,
                "health_score": health_score,
                "risk_score": risk_score,
                "criticality": criticality,
                "maintenance_cost": maintenance_cost,
                "failure_window_hours": maintenance_window,
                "predicted_issue": random.choice(POTENTIAL_FAILURE_DRIVERS),
                "x": coords["x"],
                "y": coords["y"],
                "last_service": (now - timedelta(days=since_service)).isoformat(),
                "next_service": (now + timedelta(days=next_service)).isoformat(),
                "ai_confidence": round(random.uniform(0.62, 0.94), 2),
                "estimated_downtime_hours": random.randint(4, 18),
            }
        )
    return assets


def _generate_spares() -> List[Dict[str, object]]:
    depots: List[Dict[str, object]] = []
    for idx, region in enumerate(random.sample(REGIONS, k=3), start=1):
        inventory = {part: random.randint(3, 30) for part in PARTS}
        demand = {part: max(0, qty - random.randint(-4, 8)) for part, qty in inventory.items()}
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
                "status": random.choice(["On-site", "En route", "Standby"]),
                "x": coords["x"],
                "y": coords["y"],
                "shift_start": (now - timedelta(hours=random.randint(1, 4))).isoformat(),
                "shift_end": (now + timedelta(hours=random.randint(4, 9))).isoformat(),
                "next_tasks": [
                    {
                        "asset_id": asset["id"],
                        "asset_name": asset["name"],
                        "eta_minutes": random.randint(20, 120),
                        "task": random.choice(
                            [
                                "Thermography sweep",
                                "Oil sampling",
                                "Breaker calibration",
                                "Vegetation patrol",
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
            jitter = {
                "x": max(40, min(960, last_point["x"] + random.randint(-90, 90))),
                "y": max(50, min(650, last_point["y"] + random.randint(-90, 90))),
            }
            waypoints.append(jitter)
            last_point = jitter
        routes[crew["id"]] = waypoints
    return routes


def _generate_failures(assets: List[Dict[str, object]]) -> List[Dict[str, object]]:
    risky_assets = sorted(assets, key=lambda item: item["risk_score"], reverse=True)[:5]
    failures: List[Dict[str, object]] = []
    for asset in risky_assets:
        failures.append(
            {
                "asset_id": asset["id"],
                "asset_name": asset["name"],
                "likelihood": round(random.uniform(0.58, 0.95), 2),
                "window_hours": random.choice([12, 24, 36, 48, 72]),
                "drivers": random.sample(POTENTIAL_FAILURE_DRIVERS, k=2),
            }
        )
    return failures


def _build_priority_score(asset: Dict[str, object]) -> int:
    criticality_weight = {"Low": 8, "Medium": 18, "High": 32}[asset["criticality"]]
    cost_penalty = min(18, asset["maintenance_cost"] // 3000)
    downtime_bonus = min(12, asset["estimated_downtime_hours"])
    return asset["risk_score"] + criticality_weight + downtime_bonus - cost_penalty


def _generate_maintenance_plan(assets: List[Dict[str, object]]) -> List[Dict[str, object]]:
    plan: List[Dict[str, object]] = []
    sorted_assets = sorted(assets, key=lambda item: _build_priority_score(item), reverse=True)
    for rank, asset in enumerate(sorted_assets, start=1):
        plan.append(
            {
                "rank": rank,
                "asset_id": asset["id"],
                "name": asset["name"],
                "status": asset["status"],
                "criticality": asset["criticality"],
                "priority_score": _build_priority_score(asset),
                "maintenance_cost": asset["maintenance_cost"],
                "estimated_downtime_hours": asset["estimated_downtime_hours"],
                "recommended_action": random.choice(
                    [
                        "Expedite crew dispatch",
                        "Schedule predictive maintenance",
                        "Load reroute planning",
                        "Order contingency spares",
                        "Remote diagnostics sweep",
                    ]
                ),
            }
        )
    return plan


def _generate_resolution_insights(spares: List[Dict[str, object]]) -> List[Dict[str, object]]:
    insights: List[Dict[str, object]] = []
    for part in PARTS:
        replacement_frequency = random.choice(["Monthly", "Quarterly", "Semiannual", "Annual"])
        failure_pattern = random.choice(
            [
                "Peaks after storms",
                "Gradual degradation",
                "Sudden trips",
                "Heat-related",
                "Voltage spikes",
            ]
        )
        recent_interventions = random.randint(2, 12)
        insights.append(
            {
                "part_name": part,
                "replacement_frequency": replacement_frequency,
                "failure_pattern": failure_pattern,
                "recent_interventions": recent_interventions,
                "ai_recommendation": random.choice(RESOLUTION_FINDINGS),
                "availability_score": random.randint(60, 98),
            }
        )
    return insights


def _build_ai_summary(
    assets: List[Dict[str, object]],
    plan: List[Dict[str, object]],
    crews: List[Dict[str, object]],
    resolutions: List[Dict[str, object]],
) -> str:
    critical_count = len([asset for asset in assets if asset["status"] == "Critical"])
    top_priority = plan[0]
    fastest_eta = min(
        (task["eta_minutes"] for crew in crews for task in crew["next_tasks"]),
        default=90,
    )
    strongest_insight = max(resolutions, key=lambda item: item["availability_score"])
    return (
        f"AI flagging {critical_count} critical assets. {top_priority['name']} leads the plan with "
        f"score {top_priority['priority_score']}. Fastest crew ETA {fastest_eta} min. "
        f"Focus on {strongest_insight['part_name']} for proactive swaps."
    )


def refresh_data() -> Dict[str, object]:
    global SNAPSHOT
    assets = _generate_assets()
    spares = _generate_spares()
    crews = _generate_crews(assets)
    routes = _generate_routes(crews)
    failures = _generate_failures(assets)
    maintenance_plan = _generate_maintenance_plan(assets)
    resolution_insights = _generate_resolution_insights(spares)
    snapshot = {
        "generated_at": datetime.utcnow().isoformat(),
        "assets": assets,
        "spares": spares,
        "crews": crews,
        "routes": routes,
        "failures": failures,
        "priorities": maintenance_plan,
        "maintenance_plan": maintenance_plan,
        "resolution_insights": resolution_insights,
        "ai_summary": _build_ai_summary(assets, maintenance_plan, crews, resolution_insights),
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
