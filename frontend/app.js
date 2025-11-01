const mapContainer = document.getElementById("map");
const mapMessage = document.getElementById("map-message");
const layerToggleInputs = document.querySelectorAll(
  '#layer-toggles input[type="checkbox"]'
);

const state = {
  map: null,
  mapReady: false,
  visibility: {
    assets: true,
    failures: true,
    spares: true,
    crews: true,
    routes: true,
  },
  assets: [],
  priorities: [],
  failures: [],
  spares: [],
  crews: [],
  routes: {},
  markers: {
    assets: new Map(),
    spares: new Map(),
    crews: new Map(),
    failures: [],
    routes: new Map(),
  },
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

const setMapMessage = (message, tone = "info") => {
  if (!mapMessage) return;
  if (message) {
    mapMessage.textContent = message;
    mapMessage.dataset.tone = tone;
    mapMessage.hidden = false;
  } else {
    mapMessage.hidden = true;
  }
};

const disableLayerToggles = () => {
  layerToggleInputs.forEach((input) => {
    input.disabled = true;
    input.parentElement.style.opacity = "0.6";
  });
};

const fetchJSON = async (endpoint) => {
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}`);
  }
  return response.json();
};

const injectScript = (src) =>
  new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Unable to load script ${src}`));
    document.head.appendChild(script);
  });

async function setupMap() {
  if (!mapContainer) {
    console.warn("Map container not found");
    return false;
  }

  setMapMessage("Loading interactive map…", "info");

  try {
    const config = await fetchJSON("/api/config");
    if (!config.mapplsKey) {
      setMapMessage(
        "Mappls API key is not configured. Set MAPPLS_API_KEY before launching the app.",
        "warning"
      );
      disableLayerToggles();
      return false;
    }

    await injectScript(
      `https://apis.mappls.com/advancedmaps/v1/${config.mapplsKey}/map_load?v=1.5&libraries=mappls_gl`
    );

    if (!window.mappls || typeof window.mappls.Map !== "function") {
      throw new Error("Mappls JavaScript SDK did not initialize");
    }

    state.map = new window.mappls.Map("map", {
      center: { lat: 40.744, lng: -73.97 },
      zoom: 11.5,
      zoomControl: false,
      location: false,
      traffic: false,
      clickableIcons: true,
    });

    state.mapReady = true;
    setMapMessage("", "info");
    return true;
  } catch (error) {
    console.error(error);
    setMapMessage(
      "Interactive map failed to load. Verify the Mappls key and network access, then refresh.",
      "error"
    );
    disableLayerToggles();
    return false;
  }
}

const detachLayerInstance = (instance) => {
  if (!instance) return;
  if (typeof instance.remove === "function") {
    instance.remove();
  } else if (typeof instance.setMap === "function") {
    instance.setMap(null);
  } else if (instance._remove) {
    instance._remove();
  }
};

const focusOnLocation = (lat, lng, zoom = 13) => {
  if (!state.mapReady || !state.map) return;
  if (typeof state.map.flyTo === "function") {
    state.map.flyTo({ center: { lat, lng }, zoom });
  } else {
    if (typeof state.map.setCenter === "function") {
      state.map.setCenter({ lat, lng });
    }
    if (typeof state.map.setZoom === "function") {
      state.map.setZoom(zoom);
    }
  }
};

const openMarkerPopup = (marker) => {
  if (!marker) return;
  if (typeof marker.openPopup === "function") {
    marker.openPopup();
  } else if (typeof marker.openInfoWindow === "function") {
    marker.openInfoWindow();
  } else if (typeof marker.togglePopup === "function") {
    marker.togglePopup();
  }
};

const renderAssetMarkers = () => {
  state.markers.assets.forEach((marker) => detachLayerInstance(marker));
  state.markers.assets.clear();

  if (!state.mapReady || !state.visibility.assets) return;

  state.assets.forEach((asset) => {
    const status = healthToStatus(asset.health_score);
    const marker = new window.mappls.Marker({
      map: state.map,
      position: { lat: asset.lat, lng: asset.lng },
      icon_html: `<div class="marker-pin asset ${status}">${asset.id.split("-")[0]}</div>`,
      width: 36,
      height: 36,
      popupHtml: `
        <div class="fade-in">
          <strong>${asset.name}</strong><br/>
          ${asset.type} • Health ${asset.health_score}%<br/>
          <small>Next service: ${formatDate(asset.next_service)}</small>
        </div>
      `,
    });

    state.markers.assets.set(asset.id, marker);
  });
};

const renderSpareMarkers = () => {
  state.markers.spares.forEach((marker) => detachLayerInstance(marker));
  state.markers.spares.clear();

  if (!state.mapReady || !state.visibility.spares) return;

  state.spares.forEach((depot) => {
    const marker = new window.mappls.Marker({
      map: state.map,
      position: { lat: depot.lat, lng: depot.lng },
      icon_html: '<div class="marker-pin depot">S</div>',
      width: 34,
      height: 34,
      popupHtml: `
        <div class="fade-in">
          <strong>${depot.name}</strong><br/>
          ${Object.entries(depot.inventory)
            .map(([item, qty]) => `${item.replace(/_/g, " ")}: ${qty}`)
            .join("<br/>")}
        </div>
      `,
    });

    state.markers.spares.set(depot.id, marker);
  });
};

const renderCrewMarkers = () => {
  state.markers.crews.forEach((marker) => detachLayerInstance(marker));
  state.markers.crews.clear();

  if (!state.mapReady || !state.visibility.crews) return;

  state.crews.forEach((crew) => {
    const marker = new window.mappls.Marker({
      map: state.map,
      position: { lat: crew.lat, lng: crew.lng },
      icon_html: '<div class="marker-pin crew">C</div>',
      width: 34,
      height: 34,
      popupHtml: `
        <div class="fade-in">
          <strong>${crew.name}</strong><br/>
          ${crew.status}<br/>Shift ends ${formatDate(crew.shift_end)}
        </div>
      `,
    });

    state.markers.crews.set(crew.id, marker);
  });
};

const renderFailureOverlays = () => {
  state.markers.failures.forEach((shape) => detachLayerInstance(shape));
  state.markers.failures = [];

  if (!state.mapReady || !state.visibility.failures) return;

  state.failures.forEach((failure) => {
    const asset = state.assets.find((item) => item.id === failure.asset_id);
    if (!asset) return;

    if (window.mappls && typeof window.mappls.Circle === "function") {
      const circle = new window.mappls.Circle({
        map: state.map,
        center: { lat: asset.lat, lng: asset.lng },
        radius: 800,
        strokeColor: "#f06565",
        strokeOpacity: 0.6,
        strokeWeight: 1.4,
        fillColor: "rgba(240, 101, 101, 0.18)",
        fillOpacity: 0.25,
      });
      state.markers.failures.push(circle);
    } else {
      const marker = new window.mappls.Marker({
        map: state.map,
        position: { lat: asset.lat, lng: asset.lng },
        icon_html: '<div class="marker-pin asset critical">!</div>',
        width: 32,
        height: 32,
      });
      state.markers.failures.push(marker);
    }
  });
};

const renderRoutes = () => {
  state.markers.routes.forEach((polyline) => detachLayerInstance(polyline));
  state.markers.routes.clear();

  if (!state.mapReady || !state.visibility.routes) return;

  Object.entries(state.routes).forEach(([crewId, coordinates]) => {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return;

    if (window.mappls && typeof window.mappls.Polyline === "function") {
      const path = coordinates.map(([lat, lng]) => ({ lat, lng }));
      const polyline = new window.mappls.Polyline({
        map: state.map,
        path,
        strokeColor: "#2563eb",
        strokeOpacity: 0.85,
        strokeWeight: 4,
        dashArray: [6, 4],
      });
      state.markers.routes.set(crewId, polyline);
    }
  });
};

const refreshMapLayers = (layer) => {
  switch (layer) {
    case "assets":
      renderAssetMarkers();
      break;
    case "failures":
      renderFailureOverlays();
      break;
    case "spares":
      renderSpareMarkers();
      break;
    case "crews":
      renderCrewMarkers();
      break;
    case "routes":
      renderRoutes();
      break;
    default:
      break;
  }
};

const wireLayerToggles = () => {
  layerToggleInputs.forEach((input) => {
    const { layer } = input.dataset;
    state.visibility[layer] = input.checked;
    input.addEventListener("change", (event) => {
      state.visibility[layer] = event.target.checked;
      refreshMapLayers(layer);
    });
  });
};

const renderAssetList = () => {
  const list = document.getElementById("asset-list");
  if (!list) return;
  list.innerHTML = "";

  let healthy = 0;

  state.assets.forEach((asset) => {
    const status = healthToStatus(asset.health_score);
    if (asset.health_score >= 75) {
      healthy += 1;
    }

    const item = document.createElement("li");
    item.innerHTML = `
      <div class="status-line">
        <h3>${asset.name}</h3>
        <span class="stat-pill ${status}">${asset.health_score}%</span>
      </div>
      <p>${asset.type} • Last service ${formatDate(asset.last_service)}</p>
      <p>Risk score ${asset.risk_score} • Next service ${formatDate(
        asset.next_service
      )}</p>
    `;

    item.addEventListener("click", () => {
      focusOnLocation(asset.lat, asset.lng, 13.2);
      const marker = state.markers.assets.get(asset.id);
      if (marker) {
        openMarkerPopup(marker);
      }
    });

    list.appendChild(item);
  });

  const summary = document.getElementById("asset-summary");
  if (summary) {
    summary.textContent = `${healthy}/${state.assets.length} assets in healthy condition.`;
  }
};

const renderPriorities = () => {
  const list = document.getElementById("priority-list");
  if (!list) return;
  list.innerHTML = "";

  state.priorities.slice(0, 6).forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="status-line">
        <strong>#${item.rank} ${item.name}</strong>
        <span>${item.risk_score} risk</span>
      </div>
      <p>${item.status} • Next service ${formatDate(item.next_service)}</p>
    `;

    li.addEventListener("click", () => {
      const asset = state.assets.find((assetItem) => assetItem.id === item.asset_id);
      if (!asset) return;
      focusOnLocation(asset.lat, asset.lng, 13.2);
      const marker = state.markers.assets.get(item.asset_id);
      if (marker) {
        openMarkerPopup(marker);
      }
    });

    list.appendChild(li);
  });
};

const renderFailures = () => {
  const list = document.getElementById("failure-list");
  if (!list) return;
  list.innerHTML = "";

  state.failures.forEach((failure) => {
    const asset = state.assets.find((item) => item.id === failure.asset_id);
    const li = document.createElement("li");
    li.innerHTML = `
      <h3>${failure.asset_id}</h3>
      <p>Likelihood ${(failure.likelihood * 100).toFixed(0)}% • Intervention window ${formatDuration(
        failure.window_hours / 1
      )}</p>
      <p>Drivers: ${failure.drivers.join(", ")}</p>
    `;

    li.addEventListener("click", () => {
      if (!asset) return;
      focusOnLocation(asset.lat, asset.lng, 12.8);
    });

    list.appendChild(li);
  });
};

const renderSpares = () => {
  const list = document.getElementById("spare-list");
  if (!list) return;
  list.innerHTML = "";

  state.spares.forEach((depot) => {
    const shortages = Object.entries(depot.inventory)
      .filter(([item, qty]) => qty < (depot.projected_demand?.[item] ?? qty))
      .map(([item]) => item.replace(/_/g, " "));

    const li = document.createElement("li");
    li.innerHTML = `
      <h3>${depot.name}</h3>
      <p>${
        shortages.length
          ? `Shortages: ${shortages.join(", ")}`
          : "Inventory healthy"
      }</p>
    `;

    li.addEventListener("click", () => {
      focusOnLocation(depot.lat, depot.lng, 12.5);
      const marker = state.markers.spares.get(depot.id);
      if (marker) {
        openMarkerPopup(marker);
      }
    });

    list.appendChild(li);
  });
};

const renderCrews = () => {
  const list = document.getElementById("crew-list");
  if (!list) return;
  list.innerHTML = "";

  state.crews.forEach((crew) => {
    const tasks = crew.next_tasks
      .map((task) => {
        const eta = new Date(task.eta).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        return `${task.asset_id}: ${task.task} (ETA ${eta})`;
      })
      .join("<br/>");

    const li = document.createElement("li");
    li.innerHTML = `
      <h3>${crew.name}</h3>
      <p>${crew.status} • Shift ends ${formatDate(crew.shift_end)}</p>
      <p>${tasks}</p>
    `;

    li.addEventListener("click", () => {
      focusOnLocation(crew.lat, crew.lng, 12.5);
      const marker = state.markers.crews.get(crew.id);
      if (marker) {
        openMarkerPopup(marker);
      }
      const route = state.markers.routes.get(crew.id);
      if (route && typeof route.fitBounds === "function") {
        route.fitBounds();
      }
    });

    list.appendChild(li);
  });
};

async function loadAssets() {
  state.assets = await fetchJSON("/api/assets");
  renderAssetList();
  renderAssetMarkers();
}

async function loadPriorities() {
  state.priorities = await fetchJSON("/api/priorities");
  renderPriorities();
}

async function loadFailures() {
  state.failures = await fetchJSON("/api/failures");
  renderFailures();
  renderFailureOverlays();
}

async function loadSpares() {
  state.spares = await fetchJSON("/api/spares");
  renderSpares();
  renderSpareMarkers();
}

async function loadCrews() {
  state.crews = await fetchJSON("/api/crews");
  renderCrews();
  renderCrewMarkers();
}

async function loadRoutes() {
  state.routes = await fetchJSON("/api/routes");
  renderRoutes();
}

const updateDatetime = () => {
  const now = new Date();
  const output = now.toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const element = document.getElementById("current-datetime");
  if (element) {
    element.textContent = output;
  }
};

async function initialize() {
  wireLayerToggles();
  setInterval(updateDatetime, 1000);
  updateDatetime();

  const mapLoaded = await setupMap();

  try {
    await loadAssets();
    await Promise.all([
      loadPriorities(),
      loadFailures(),
      loadSpares(),
      loadCrews(),
      loadRoutes(),
    ]);
  } catch (error) {
    console.error("Failed to load dashboard data", error);
  }

  if (mapLoaded) {
    ["assets", "failures", "spares", "crews", "routes"].forEach((layer) =>
      refreshMapLayers(layer)
    );
  }
}

initialize();

// Inform implementers how to configure the Mappls API key when viewing the source.
console.info(
  "Set MAPPLS_API_KEY in your environment before running uvicorn so the Mappls map initializes."
);
