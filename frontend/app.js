const map = L.map("map", {
  zoomControl: false,
}).setView([40.744, -73.97], 11.8);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

L.control
  .zoom({ position: "bottomright" })
  .addTo(map);

const layerGroups = {
  assets: L.layerGroup().addTo(map),
  failures: L.layerGroup().addTo(map),
  spares: L.layerGroup().addTo(map),
  crews: L.layerGroup().addTo(map),
  routes: L.layerGroup().addTo(map),
};

const assetMarkers = new Map();
const crewMarkers = new Map();
const routeLayers = new Map();

const healthToColor = (score) => {
  if (score >= 90) return "#6fcf97";
  if (score >= 75) return "#56ccf2";
  if (score >= 60) return "#f2c94c";
  if (score >= 45) return "#f2994a";
  return "#eb5757";
};

const healthToStatus = (score) => {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "fair";
  if (score >= 45) return "risk";
  return "critical";
};

const formatDate = (value) => {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDuration = (hours) => {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  return `${hours.toFixed(1)} hr`;
};

const updateDatetime = () => {
  const now = new Date();
  document.getElementById("current-datetime").textContent = now.toLocaleString();
};

setInterval(updateDatetime, 1000);
updateDatetime();

async function loadAssets() {
  const response = await fetch("/api/assets");
  const assets = await response.json();

  const list = document.getElementById("asset-list");
  list.innerHTML = "";

  let healthy = 0;
  assets.forEach((asset) => {
    const color = healthToColor(asset.health_score);
    const status = healthToStatus(asset.health_score);

    const marker = L.circleMarker([asset.lat, asset.lng], {
      radius: 9,
      color,
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.8,
    }).bindPopup(
      `<strong>${asset.name}</strong><br/>` +
        `${asset.type} &bull; Health ${asset.health_score}%<br/>` +
        `<small>Next service: ${formatDate(asset.next_service)}</small>`
    );

    marker.addTo(layerGroups.assets);
    assetMarkers.set(asset.id, marker);

    const item = document.createElement("li");
    item.innerHTML = `
      <h3>${asset.name}</h3>
      <p>${asset.type} &bull; Last service ${formatDate(asset.last_service)}</p>
      <div class="status-line">
        <span class="stat-pill ${status}">
          <span>${asset.health_score}%</span> health
        </span>
        <span>Risk score ${asset.risk_score}</span>
      </div>
    `;

    item.addEventListener("click", () => {
      map.setView([asset.lat, asset.lng], 13);
      marker.openPopup();
    });

    list.appendChild(item);

    if (asset.health_score >= 75) healthy += 1;
  });

  document.getElementById(
    "asset-summary"
  ).textContent = `${healthy}/${assets.length} assets in healthy condition.`;
}

async function loadPriorities() {
  const response = await fetch("/api/priorities");
  const priorities = await response.json();
  const list = document.getElementById("priority-list");
  list.innerHTML = "";

  priorities.slice(0, 6).forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="status-line">
        <strong>#${item.rank} ${item.name}</strong>
        <span>${item.risk_score} risk</span>
      </div>
      <p>${item.status} • Next service ${formatDate(item.next_service)}</p>
    `;

    li.addEventListener("click", () => {
      const marker = assetMarkers.get(item.asset_id);
      if (marker) {
        map.setView(marker.getLatLng(), 13);
        marker.openPopup();
      }
    });

    list.appendChild(li);
  });
}

async function loadFailures() {
  const response = await fetch("/api/failures");
  const failures = await response.json();
  const list = document.getElementById("failure-list");
  list.innerHTML = "";

  failures.forEach((failure) => {
    const marker = assetMarkers.get(failure.asset_id);
    if (!marker) return;

    const coords = marker.getLatLng();
    const circle = L.circle(coords, {
      radius: 800,
      color: "#eb5757",
      weight: 1.2,
      fillColor: "#eb5757",
      fillOpacity: 0.12,
      dashArray: "6 6",
    })
      .bindPopup(
        `<strong>Risk Alert</strong><br/>Asset: ${failure.asset_id}<br/>` +
          `Probability ${(failure.likelihood * 100).toFixed(0)}%<br/>` +
          `<small>Window: next ${failure.window_hours}h</small>`
      )
      .addTo(layerGroups.failures);

    const li = document.createElement("li");
    const duration = formatDuration(failure.window_hours / 1);
    li.innerHTML = `
      <h3>${failure.asset_id}</h3>
      <p>Likelihood ${(failure.likelihood * 100).toFixed(0)}% • Intervention window ${duration}</p>
      <p>Drivers: ${failure.drivers.join(", ")}</p>
    `;
    li.addEventListener("click", () => {
      map.fitBounds(circle.getBounds());
      circle.openPopup();
    });

    list.appendChild(li);
  });
}

async function loadSpares() {
  const response = await fetch("/api/spares");
  const depots = await response.json();
  const list = document.getElementById("spare-list");
  list.innerHTML = "";

  depots.forEach((depot) => {
    const marker = L.marker([depot.lat, depot.lng], {
      icon: L.divIcon({
        className: "depot-icon",
        html: '<div class="marker depot">S</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    })
      .bindPopup(
        `<strong>${depot.name}</strong><br/>` +
          Object.entries(depot.inventory)
            .map(([item, qty]) => `${item}: ${qty}`)
            .join("<br/>")
      )
      .addTo(layerGroups.spares);

    const li = document.createElement("li");
    const shortages = Object.entries(depot.inventory)
      .filter(([key, qty]) => qty < depot.projected_demand[key])
      .map(([key]) => key.replace(/_/g, " "));

    li.innerHTML = `
      <h3>${depot.name}</h3>
      <p>${shortages.length ? `Shortages: ${shortages.join(", ")}` : "Inventory healthy"}</p>
    `;
    li.addEventListener("click", () => {
      map.setView([depot.lat, depot.lng], 13);
      marker.openPopup();
    });

    list.appendChild(li);
  });
}

async function loadCrews() {
  const response = await fetch("/api/crews");
  const crews = await response.json();
  const list = document.getElementById("crew-list");
  list.innerHTML = "";

  crews.forEach((crew) => {
    const marker = L.marker([crew.lat, crew.lng], {
      icon: L.divIcon({
        className: "crew-icon",
        html: '<div class="marker crew">C</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    })
      .bindPopup(
        `<strong>${crew.name}</strong><br/>` +
          `${crew.status}<br/>Shift ends ${formatDate(crew.shift_end)}`
      )
      .addTo(layerGroups.crews);

    crewMarkers.set(crew.id, marker);

    const li = document.createElement("li");
    const tasks = crew.next_tasks
      .map(
        (task) =>
          `${task.asset_id}: ${task.task} (ETA ${new Date(task.eta).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })})`
      )
      .join("<br/>");

    li.innerHTML = `
      <h3>${crew.name}</h3>
      <p>${crew.status} • Shift ends ${formatDate(crew.shift_end)}</p>
      <p>${tasks}</p>
    `;

    li.addEventListener("click", () => {
      map.setView([crew.lat, crew.lng], 13);
      marker.openPopup();
    });

    list.appendChild(li);
  });
}

async function loadRoutes() {
  const response = await fetch("/api/routes");
  const routes = await response.json();

  Object.entries(routes).forEach(([crewId, coordinates]) => {
    const polyline = L.polyline(coordinates, {
      color: "#2f80ed",
      weight: 3,
      dashArray: "6 4",
      opacity: 0.8,
    }).addTo(layerGroups.routes);

    routeLayers.set(crewId, polyline);
  });
}

function wireLayerToggles() {
  document.querySelectorAll('.toggles input[type="checkbox"]').forEach((input) => {
    input.addEventListener("change", (event) => {
      const layer = event.target.dataset.layer;
      const group = layerGroups[layer];
      if (!group) return;
      if (event.target.checked) {
        group.addTo(map);
      } else {
        map.removeLayer(group);
      }
    });
  });
}

function applyMarkerStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .marker {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      color: white;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .marker.depot {
      background: linear-gradient(135deg, #56ccf2, #2f80ed);
      box-shadow: 0 4px 12px rgba(47, 128, 237, 0.35);
    }
    .marker.crew {
      background: linear-gradient(135deg, #bb6bd9, #9b51e0);
      box-shadow: 0 4px 12px rgba(155, 81, 224, 0.35);
    }
  `;
  document.head.appendChild(style);
}

async function initialize() {
  wireLayerToggles();
  applyMarkerStyles();
  await loadAssets();
  await Promise.all([loadPriorities(), loadFailures(), loadSpares(), loadCrews(), loadRoutes()]);
}

initialize();
