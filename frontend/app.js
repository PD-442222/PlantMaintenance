(() => {
  const state = {
    data: null,
    planSort: "risk",
    filterHigh: false,
    zoom: 1,
    offset: { x: 0, y: 0 },
    isDragging: false,
    dragOrigin: { x: 0, y: 0 },
    startOffset: { x: 0, y: 0 },
    pointerId: null,
    popoverLocked: false,
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    attachEvents();
    resetMapView();
    loadDashboard();
  }

  function cacheElements() {
    els.refreshBtn = document.getElementById("refreshBtn");
    els.generatedAt = document.getElementById("generatedAt");
    els.aiSummary = document.getElementById("aiSummary");
    els.criticalCount = document.getElementById("criticalCount");
    els.warningCount = document.getElementById("warningCount");
    els.healthyCount = document.getElementById("healthyCount");
    els.planTableBody = document.getElementById("planTableBody");
    els.sortRiskBtn = document.getElementById("sortRiskBtn");
    els.sortCostBtn = document.getElementById("sortCostBtn");
    els.filterHighBtn = document.getElementById("filterHighBtn");
    els.crewTimeline = document.getElementById("crewTimeline");
    els.crewSummary = document.getElementById("crewSummary");
    els.crewNarrative = document.getElementById("crewNarrative");
    els.resolutionTableBody = document.getElementById("resolutionTableBody");
    els.resolutionInsight = document.getElementById("resolutionInsight");
    els.mapViewport = document.getElementById("mapViewport");
    els.mapInner = document.getElementById("mapInner");
    els.markerLayer = document.getElementById("markerLayer");
    els.gridOverlay = document.getElementById("gridOverlay");
    els.zoomInBtn = document.getElementById("zoomInBtn");
    els.zoomOutBtn = document.getElementById("zoomOutBtn");
    els.resetViewBtn = document.getElementById("resetViewBtn");
    els.markerPopover = document.getElementById("markerPopover");
  }

  function attachEvents() {
    els.refreshBtn.addEventListener("click", () => loadDashboard(true));
    els.sortRiskBtn.addEventListener("click", () => {
      state.planSort = "risk";
      renderMaintenancePlan();
      updatePlanButtons();
    });
    els.sortCostBtn.addEventListener("click", () => {
      state.planSort = "cost";
      renderMaintenancePlan();
      updatePlanButtons();
    });
    els.filterHighBtn.addEventListener("click", () => {
      state.filterHigh = !state.filterHigh;
      els.filterHighBtn.setAttribute("aria-pressed", String(state.filterHigh));
      renderMaintenancePlan();
    });

    els.zoomInBtn.addEventListener("click", () => changeZoom(0.15));
    els.zoomOutBtn.addEventListener("click", () => changeZoom(-0.15));
    els.resetViewBtn.addEventListener("click", resetMapView);

    els.mapViewport.addEventListener("pointerdown", startDrag);
    els.mapViewport.addEventListener("pointermove", onDrag);
    els.mapViewport.addEventListener("pointerup", endDrag);
    els.mapViewport.addEventListener("pointerleave", endDrag);
    els.mapViewport.addEventListener("wheel", onWheel, { passive: false });

    window.addEventListener("resize", resetMapView);

    document.addEventListener("click", (event) => {
      if (!els.markerPopover.contains(event.target)) {
        state.popoverLocked = false;
        hidePopover();
      }
    });
  }

  async function loadDashboard(refresh = false) {
    try {
      els.refreshBtn.disabled = true;
      els.refreshBtn.classList.add("loading");
      const response = await fetch(refresh ? "/api/refresh" : "/api/dashboard", {
        method: refresh ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to load dashboard data");
      const data = await response.json();
      state.data = data;
      renderDashboard();
    } catch (error) {
      console.error(error);
    } finally {
      els.refreshBtn.disabled = false;
      els.refreshBtn.classList.remove("loading");
    }
  }

  function renderDashboard() {
    if (!state.data) return;
    const generatedAt = new Date(state.data.generated_at || Date.now());
    els.generatedAt.textContent = `Updated ${generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

    renderMap();
    renderAssetSummary();
    renderMaintenancePlan();
    updatePlanButtons();
    renderCrewSchedule();
    renderResolution();
  }

  function renderMap() {
    if (!state.data) return;
    state.popoverLocked = false;
    hidePopover();
    els.markerLayer.innerHTML = "";
    const assets = state.data.assets || [];
    const crews = state.data.crews || [];
    const depots = state.data.spares || [];

    assets.forEach((asset) => {
      const marker = createMarker("asset", asset);
      if (asset.status === "Critical") marker.classList.add("pulse");
      marker.dataset.health = asset.status.toLowerCase();
      marker.classList.add(asset.status.toLowerCase());
      marker.textContent = "A";
      attachMarkerInteractions(marker, () => assetPopoverContent(asset));
      els.markerLayer.appendChild(marker);
      requestAnimationFrame(() => marker.classList.add("spawn"));
    });

    crews.forEach((crew) => {
      const marker = createMarker("crew", crew);
      marker.textContent = "C";
      attachMarkerInteractions(marker, () => crewPopoverContent(crew));
      els.markerLayer.appendChild(marker);
      requestAnimationFrame(() => marker.classList.add("spawn"));
    });

    depots.forEach((depot) => {
      const marker = createMarker("depot", depot);
      marker.textContent = "D";
      attachMarkerInteractions(marker, () => depotPopoverContent(depot));
      els.markerLayer.appendChild(marker);
      requestAnimationFrame(() => marker.classList.add("spawn"));
    });
  }

  function createMarker(type, item) {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "marker";
    marker.dataset.type = type;
    marker.style.left = `${item.x}px`;
    marker.style.top = `${item.y}px`;
    marker.setAttribute("aria-label", `${type} marker for ${item.name || item.id}`);
    return marker;
  }

  function attachMarkerInteractions(marker, contentFactory) {
    let hideTimer;

    marker.addEventListener("mouseenter", (event) => {
      if (state.popoverLocked) return;
      clearTimeout(hideTimer);
      showPopover(event.currentTarget, contentFactory());
    });

    marker.addEventListener("mouseleave", () => {
      if (state.popoverLocked) return;
      hideTimer = setTimeout(hidePopover, 120);
    });

    marker.addEventListener("click", (event) => {
      event.stopPropagation();
      state.popoverLocked = true;
      clearTimeout(hideTimer);
      showPopover(event.currentTarget, contentFactory());
    });
  }

  function showPopover(marker, content) {
    els.markerPopover.innerHTML = content;
    const rect = marker.getBoundingClientRect();
    els.markerPopover.style.left = `${rect.left + rect.width / 2}px`;
    els.markerPopover.style.top = `${rect.top - 8}px`;
    els.markerPopover.classList.add("visible");
  }

  function hidePopover() {
    els.markerPopover.classList.remove("visible");
  }

  function assetPopoverContent(asset) {
    const cost = formatCurrency(asset.maintenance_cost);
    const confidence = Math.round((asset.ai_confidence || 0) * 100);
    return `
      <h3>${asset.name}</h3>
      <p>Status: <strong>${asset.status}</strong> · Criticality: ${asset.criticality}</p>
      <p>Risk score <strong>${asset.risk_score}</strong> · Priority ${confidence}% confidence</p>
      <p>Predicted issue: ${asset.predicted_issue}</p>
      <p>Failure window: ${asset.failure_window_hours} hrs · Est. downtime: ${asset.estimated_downtime_hours} hrs</p>
      <p>Maintenance cost: ${cost}</p>
      <div class="chips">
        <span class="chip">${asset.type}</span>
        <span class="chip">${asset.region}</span>
        <span class="chip">Next service ${formatRelative(asset.next_service)}</span>
      </div>
    `;
  }

  function crewPopoverContent(crew) {
    const tasks = (crew.next_tasks || [])
      .map((task) => `<li><strong>${task.asset_name}</strong> · ${task.task} · ETA ${task.eta_minutes} min</li>`)
      .join("");
    return `
      <h3>${crew.name}</h3>
      <p>Status: <strong>${crew.status}</strong></p>
      <p>Shift window: ${formatTimeRange(crew.shift_start, crew.shift_end)}</p>
      <p>Upcoming tasks:</p>
      <ul>${tasks || "<li>No tasks scheduled</li>"}</ul>
    `;
  }

  function depotPopoverContent(depot) {
    const topInventory = Object.entries(depot.inventory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([part, qty]) => `<li>${part}: ${qty}</li>`)
      .join("");
    return `
      <h3>${depot.name}</h3>
      <p>Region: ${depot.region}</p>
      <p>Top inventory:</p>
      <ul>${topInventory}</ul>
    `;
  }

  function renderAssetSummary() {
    const assets = state.data?.assets || [];
    const counts = assets.reduce(
      (acc, asset) => {
        const status = asset.status.toLowerCase();
        if (status === "critical") acc.critical += 1;
        else if (status === "warning") acc.warning += 1;
        else acc.healthy += 1;
        return acc;
      },
      { critical: 0, warning: 0, healthy: 0 }
    );
    els.criticalCount.textContent = counts.critical;
    els.warningCount.textContent = counts.warning;
    els.healthyCount.textContent = counts.healthy;
    els.aiSummary.textContent = state.data.ai_summary || "AI monitor online";
  }

  function renderMaintenancePlan() {
    if (!state.data) return;
    const plan = [...(state.data.maintenance_plan || state.data.priorities || [])];
    if (!plan.length) {
      els.planTableBody.innerHTML = "<tr><td colspan=6>No plan data</td></tr>";
      return;
    }

    let working = plan;
    if (state.filterHigh) {
      const maxScore = Math.max(...plan.map((item) => item.priority_score));
      const threshold = maxScore - 10;
      working = plan.filter((item) => item.priority_score >= threshold);
    }

    if (state.planSort === "cost") {
      working = [...working].sort((a, b) => a.maintenance_cost - b.maintenance_cost);
    } else {
      working = [...working].sort((a, b) => b.priority_score - a.priority_score);
    }

    if (!working.length) {
      els.planTableBody.innerHTML = "<tr><td colspan=6>No plan data</td></tr>";
      return;
    }

    const topScore = Math.max(...working.map((item) => item.priority_score));
    const rows = working.slice(0, 12).map((item) => {
      const badgeClass = item.criticality.toLowerCase();
      const highlight = item.priority_score >= topScore - 5;
      return `
        <tr class="${highlight ? "highlight" : ""}">
          <td>${item.rank}</td>
          <td>
            <div>${item.name}</div>
            <div class="sub">ETA ${item.estimated_downtime_hours} hrs downtime</div>
          </td>
          <td><span class="badge ${badgeClass}">${item.criticality}</span></td>
          <td>${item.priority_score}</td>
          <td><span class="badge costly">${formatCurrency(item.maintenance_cost)}</span></td>
          <td>${item.recommended_action}</td>
        </tr>
      `;
    });

    els.planTableBody.innerHTML = rows.join("");
  }

  function updatePlanButtons() {
    els.sortRiskBtn.classList.toggle("active", state.planSort === "risk");
    els.sortCostBtn.classList.toggle("active", state.planSort === "cost");
  }

  function renderCrewSchedule() {
    const crews = state.data?.crews || [];
    els.crewTimeline.innerHTML = "";
    els.crewSummary.innerHTML = "";
    if (!crews.length) return;

    crews.forEach((crew) => {
      const row = document.createElement("div");
      row.className = "crew-row";

      const meta = document.createElement("div");
      meta.className = "crew-meta";
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = crew.name;
      const status = document.createElement("div");
      status.className = "status";
      status.textContent = `${crew.status} • shift ends ${formatRelative(crew.shift_end)}`;
      meta.append(name, status);

      const bar = document.createElement("div");
      bar.className = "timeline-bar";
      const crewTasks = crew.next_tasks || [];
      const totalMinutes = crewTasks.reduce((acc, task) => acc + task.eta_minutes, 0) || 1;
      let cursor = 0;
      crewTasks.forEach((task) => {
        const portion = Math.max(12, (task.eta_minutes / totalMinutes) * 100 * 0.85);
        const block = document.createElement("div");
        block.className = "timeline-block";
        block.style.left = `${Math.min(88, cursor)}%`;
        block.style.width = `${Math.min(100, portion)}%`;
        block.title = `${task.asset_name} · ${task.task} · ETA ${task.eta_minutes} min`;
        cursor += portion + 4;
        bar.appendChild(block);
      });

      row.append(meta, bar);
      els.crewTimeline.appendChild(row);
    });

    const onSite = crews.filter((crew) => crew.status === "On-site").length;
    const enRoute = crews.filter((crew) => crew.status === "En route").length;
    const standby = crews.filter((crew) => crew.status === "Standby").length;
    const totalTasks = crews.reduce((acc, crew) => acc + (crew.next_tasks ? crew.next_tasks.length : 0), 0);

    els.crewSummary.innerHTML = `
      <div class="summary-card">${onSite} crews currently on-site</div>
      <div class="summary-card">${enRoute} crews en route, ${standby} on standby</div>
      <div class="summary-card">${totalTasks} tasks queued with AI sequencing</div>
    `;

    const fastestEta = Math.min(
      ...crews.flatMap((crew) => crew.next_tasks.map((task) => task.eta_minutes))
    );
    if (Number.isFinite(fastestEta)) {
      els.crewNarrative.textContent = `AI sequencing keeps ${crews.length} crews aligned. Fastest dispatch ETA ${fastestEta} minutes, minimizing downtime across service regions.`;
    }
  }

  function renderResolution() {
    const insights = state.data?.resolution_insights || [];
    if (!insights.length) {
      els.resolutionTableBody.innerHTML = "<tr><td colspan=5>No insights available</td></tr>";
      return;
    }
    const rows = insights.map((item) => {
      return `
        <tr>
          <td>${item.part_name}</td>
          <td>${item.replacement_frequency}</td>
          <td>${item.failure_pattern}</td>
          <td>${item.recent_interventions}</td>
          <td>${item.ai_recommendation}</td>
        </tr>
      `;
    });
    els.resolutionTableBody.innerHTML = rows.join("");

    const top = insights.reduce((best, item) =>
      item.availability_score > best.availability_score ? item : best
    );
    els.resolutionInsight.textContent = `${top.ai_recommendation}. Availability confidence ${top.availability_score}%.`;
  }

  function startDrag(event) {
    event.preventDefault();
    state.isDragging = true;
    state.pointerId = event.pointerId;
    els.mapViewport.setPointerCapture(state.pointerId);
    state.dragOrigin = { x: event.clientX, y: event.clientY };
    state.startOffset = { ...state.offset };
  }

  function onDrag(event) {
    if (!state.isDragging || event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.dragOrigin.x;
    const dy = event.clientY - state.dragOrigin.y;
    state.offset.x = state.startOffset.x + dx;
    state.offset.y = state.startOffset.y + dy;
    updateMapTransform();
  }

  function endDrag(event) {
    if (state.isDragging && event.pointerId === state.pointerId) {
      state.isDragging = false;
      els.mapViewport.releasePointerCapture(state.pointerId);
    }
  }

  function onWheel(event) {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.12 : -0.12;
    changeZoom(delta, event);
  }

  function changeZoom(delta, originEvent) {
    const newZoom = clamp(state.zoom + delta, 0.6, 1.8);
    if (newZoom === state.zoom) return;

    if (originEvent) {
      const rect = els.mapViewport.getBoundingClientRect();
      const pointerX = originEvent.clientX - rect.left;
      const pointerY = originEvent.clientY - rect.top;
      const mapX = (pointerX - state.offset.x) / state.zoom;
      const mapY = (pointerY - state.offset.y) / state.zoom;
      state.offset.x = pointerX - mapX * newZoom;
      state.offset.y = pointerY - mapY * newZoom;
    } else {
      const rect = els.mapViewport.getBoundingClientRect();
      state.offset.x = (rect.width - 1000 * newZoom) / 2;
      state.offset.y = (rect.height - 700 * newZoom) / 2;
    }

    state.zoom = newZoom;
    updateMapTransform();
  }

  function resetMapView() {
    const rect = els.mapViewport.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      requestAnimationFrame(resetMapView);
      return;
    }
    const fitZoom = Math.min(rect.width / 1000, rect.height / 700);
    state.zoom = clamp(fitZoom, 0.6, 1.2);
    state.offset.x = (rect.width - 1000 * state.zoom) / 2;
    state.offset.y = (rect.height - 700 * state.zoom) / 2;
    updateMapTransform();
  }

  function updateMapTransform() {
    els.mapInner.style.transform = `scale(${state.zoom})`;
    els.mapInner.style.left = `${state.offset.x}px`;
    els.mapInner.style.top = `${state.offset.y}px`;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  function formatRelative(dateString) {
    if (!dateString) return "n/a";
    const target = new Date(dateString);
    const now = new Date();
    const diff = target - now;
    const days = Math.round(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `in ${days} day${days === 1 ? "" : "s"}`;
    if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
    return "today";
  }

  function formatTimeRange(start, end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
})();
