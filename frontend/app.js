(function () {
  const api = {
    dashboard: () => fetchJson('/api/dashboard'),
    refresh: () => fetchJson('/api/refresh', { method: 'POST' }),
  };

  const state = {
    snapshot: null,
    zoom: 0.85,
    panX: -60,
    panY: -40,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    panOrigin: { x: 0, y: 0 },
  };

  const elements = {};

  document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    bindEvents();
    loadInitial();
  });

  function cacheElements() {
    elements.mapViewport = document.getElementById('mapViewport');
    elements.mapInner = document.getElementById('mapInner');
    elements.markerLayer = document.getElementById('markerLayer');
    elements.routeLayer = document.getElementById('routeLayer');
    elements.refreshBtn = document.getElementById('refreshBtn');
    elements.timestamp = document.getElementById('generatedAt');
    elements.lensList = document.getElementById('lensList');
    elements.healthBreakdown = document.getElementById('healthBreakdown');
    elements.regionList = document.getElementById('regionList');
    elements.assetList = document.getElementById('assetList');
    elements.priorityList = document.getElementById('priorityList');
    elements.crewList = document.getElementById('crewList');
    elements.popover = document.getElementById('markerPopover');
  }

  function bindEvents() {
    elements.refreshBtn.addEventListener('click', handleRefresh);
    window.addEventListener('resize', () => hidePopover());

    elements.mapViewport.addEventListener('wheel', handleZoom, { passive: false });
    elements.mapViewport.addEventListener('pointerdown', startPan);
    window.addEventListener('pointermove', panMove);
    window.addEventListener('pointerup', endPan);
    window.addEventListener('scroll', () => hidePopover());
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hidePopover();
      }
    });
  }

  async function loadInitial() {
    try {
      setLoading(true);
      const snapshot = await api.dashboard();
      state.snapshot = snapshot;
      renderSnapshot();
    } catch (error) {
      console.error('Failed to load dashboard data', error);
      setStatusMessage('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    elements.refreshBtn.disabled = isLoading;
    elements.refreshBtn.setAttribute('aria-busy', String(isLoading));
    elements.refreshBtn.classList.toggle('is-loading', isLoading);
  }

  function setStatusMessage(message) {
    elements.timestamp.textContent = message;
  }

  async function handleRefresh() {
    try {
      setLoading(true);
      hidePopover();
      const snapshot = await api.refresh();
      state.snapshot = snapshot;
      renderSnapshot(true);
    } catch (error) {
      console.error('Refresh failed', error);
      setStatusMessage('Refresh failed');
    } finally {
      setLoading(false);
    }
  }

  function renderSnapshot(isRefresh = false) {
    if (!state.snapshot) {
      return;
    }
    const { generated_at: generatedAt } = state.snapshot;
    if (generatedAt) {
      const display = new Date(generatedAt).toLocaleString();
      elements.timestamp.textContent = `Updated ${display}`;
    }

    renderSidebar();
    renderMap(isRefresh);
    renderPanels();
  }

  function renderSidebar() {
    const assets = state.snapshot.assets || [];
    const lensConfig = [
      { label: 'All assets', count: assets.length },
      {
        label: 'High risk',
        count: assets.filter((item) => item.risk_score >= 40).length,
      },
      {
        label: 'Upcoming maintenance',
        count: assets.filter((item) => daysUntil(item.next_service) <= 14).length,
      },
      {
        label: 'Extended service gaps',
        count: assets.filter((item) => daysSince(item.last_service) >= 120).length,
      },
    ];

    elements.lensList.innerHTML = lensConfig
      .map((lens) => `<li><strong>${lens.count}</strong> ${lens.label}</li>`)
      .join('');

    const healthCounts = assets.reduce((acc, asset) => {
      acc[asset.status] = (acc[asset.status] || 0) + 1;
      return acc;
    }, {});

    const order = ['Excellent', 'Good', 'Warning', 'Critical'];
    elements.healthBreakdown.innerHTML = order
      .filter((status) => healthCounts[status])
      .map((status) => {
        const tier = status.toLowerCase();
        return `
          <div class="status-row">
            <span class="badge ${tier}">
              <span class="dot" aria-hidden="true"></span>
              ${status}
            </span>
            <span class="count">${healthCounts[status]}</span>
          </div>
        `;
      })
      .join('');

    const regions = groupBy(assets, (asset) => asset.region);
    elements.regionList.innerHTML = Object.entries(regions)
      .map(([region, items]) => `<li><strong>${items.length}</strong> ${region}</li>`)
      .join('');
  }

  function renderPanels() {
    renderAssetPanel();
    renderRiskPanel();
    renderCrewPanel();
  }

  function renderAssetPanel() {
    const assets = (state.snapshot.assets || []).slice(0, 6);
    elements.assetList.innerHTML = assets
      .map((asset) => {
        const nextService = new Date(asset.next_service).toLocaleDateString();
        const badgeClass = badgeFor(asset.status);
        return `
          <li class="item-card" data-marker="${asset.id}">
            <header>
              <span>${asset.name}</span>
              <span class="badge ${badgeClass}">${asset.status}</span>
            </header>
            <div class="meta">Type • ${asset.type}</div>
            <div class="meta">Next service • ${nextService}</div>
          </li>
        `;
      })
      .join('');

    elements.assetList.querySelectorAll('[data-marker]').forEach((node) => {
      node.addEventListener('click', () => {
        const asset = state.snapshot.assets.find((item) => item.id === node.dataset.marker);
        if (asset) {
          focusMarker(asset.id);
          showPopover(asset, node.getBoundingClientRect());
        }
      });
    });
  }

  function renderRiskPanel() {
    const priorities = (state.snapshot.priorities || []).slice(0, 5);
    elements.priorityList.innerHTML = priorities
      .map((item) => `
        <li class="item-card">
          <header>
            <span>#${item.rank} ${item.name}</span>
            <span class="badge ${badgeFor(item.status)}">Risk ${item.risk_score}</span>
          </header>
          <div class="meta">Next service window • ${new Date(item.next_service).toLocaleDateString()}</div>
        </li>
      `)
      .join('');
  }

  function renderCrewPanel() {
    const crews = state.snapshot.crews || [];
    elements.crewList.innerHTML = crews
      .map((crew) => {
        const tasks = (crew.next_tasks || [])
          .map((task) => `${task.asset_name} · ETA ${formatTime(task.eta)}`)
          .join('<br />');
        return `
          <li class="item-card" data-crew="${crew.id}">
            <header>
              <span>${crew.name}</span>
              <span class="badge">${crew.status}</span>
            </header>
            <div class="meta">Shift ends • ${formatTime(crew.shift_end)}</div>
            <div class="meta">${tasks}</div>
          </li>
        `;
      })
      .join('');

    elements.crewList.querySelectorAll('[data-crew]').forEach((node) => {
      node.addEventListener('click', () => {
        const crew = state.snapshot.crews.find((item) => item.id === node.dataset.crew);
        if (crew) {
          focusMarker(crew.id);
        }
      });
    });
  }

  function renderMap(isRefresh) {
    applyTransform();
    drawRoutes();
    drawMarkers(isRefresh);
  }

  function drawRoutes() {
    elements.routeLayer.innerHTML = '';
    const routes = state.snapshot.routes || {};
    Object.entries(routes).forEach(([crewId, waypoints]) => {
      if (!Array.isArray(waypoints) || waypoints.length === 0) {
        return;
      }
      const crew = state.snapshot.crews.find((item) => item.id === crewId);
      if (!crew) {
        return;
      }
      const points = [{ x: crew.x, y: crew.y }, ...waypoints];
      const path = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
        .join(' ');
      const container = document.createElement('div');
      container.className = 'route-path';
      container.innerHTML = `
        <svg width="0" height="0">
          <path d="${path}" fill="none" stroke="rgba(129, 140, 248, 0.6)" stroke-width="2" stroke-dasharray="6 6" stroke-linecap="round" />
        </svg>
      `;
      elements.routeLayer.appendChild(container);
    });
  }

  function drawMarkers(isRefresh) {
    elements.markerLayer.innerHTML = '';
    const fragment = document.createDocumentFragment();

    (state.snapshot.assets || []).forEach((asset) => {
      const marker = createMarkerElement({
        id: asset.id,
        label: 'A',
        className: `marker asset-${asset.status}`,
        x: asset.x,
        y: asset.y,
        title: `${asset.name}\nStatus: ${asset.status}`,
        onClick: (event) => showPopover(asset, event.target.getBoundingClientRect(), event),
      });
      if (isRefresh) {
        marker.classList.add('refreshing');
      }
      fragment.appendChild(marker);
    });

    (state.snapshot.crews || []).forEach((crew) => {
      const marker = createMarkerElement({
        id: crew.id,
        label: 'C',
        className: 'marker crew',
        x: crew.x,
        y: crew.y,
        title: `${crew.name}\n${crew.status}`,
        onClick: (event) => showPopover(crewPopoverData(crew), event.target.getBoundingClientRect(), event),
      });
      fragment.appendChild(marker);
    });

    (state.snapshot.spares || []).forEach((depot) => {
      const marker = createMarkerElement({
        id: depot.id,
        label: 'D',
        className: 'marker depot',
        x: depot.x,
        y: depot.y,
        title: `${depot.name}`,
        onClick: (event) => showPopover(depotPopoverData(depot), event.target.getBoundingClientRect(), event),
      });
      fragment.appendChild(marker);
    });

    elements.markerLayer.appendChild(fragment);
  }

  function createMarkerElement({ id, label, className, x, y, title, onClick }) {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = className;
    marker.dataset.id = id;
    marker.textContent = label;
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.title = title;
    marker.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick(event);
    });
    marker.addEventListener('mouseenter', () => marker.classList.add('hover'));
    marker.addEventListener('mouseleave', () => marker.classList.remove('hover'));
    return marker;
  }

  function focusMarker(markerId) {
    const node = elements.markerLayer.querySelector(`[data-id="${markerId}"]`);
    if (node) {
      node.classList.add('refreshing');
      setTimeout(() => node.classList.remove('refreshing'), 500);
    }
  }

  function crewPopoverData(crew) {
    return {
      name: crew.name,
      status: crew.status,
      content: `Shift ends ${formatTime(crew.shift_end)}`,
      detail: (crew.next_tasks || []).slice(0, 2).map((task) => `${task.asset_name} → ${formatTime(task.eta)}`).join('<br />'),
    };
  }

  function depotPopoverData(depot) {
    const topNeed = Object.entries(depot.projected_demand || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([part, qty]) => `${formatLabel(part)}: ${qty}`)
      .join('<br />');
    return {
      name: depot.name,
      status: `${depot.region} depot`,
      content: `Inventory lines ${Object.keys(depot.inventory || {}).length}`,
      detail: topNeed,
    };
  }

  function showPopover(item, rect, event) {
    if (!item) return;
    const popoverData = normalisePopover(item);
    const popover = elements.popover;
    const mapRect = elements.mapViewport.getBoundingClientRect();
    const pointerX = event?.clientX || rect.left + rect.width / 2;
    const pointerY = event?.clientY || rect.top + rect.height / 2;

    popover.innerHTML = `
      <h3>${popoverData.title}</h3>
      <p class="highlight">${popoverData.subtitle}</p>
      <p>${popoverData.detail}</p>
    `;
    popover.style.left = `${Math.min(Math.max(pointerX, mapRect.left + 40), mapRect.right - 40)}px`;
    popover.style.top = `${pointerY - 30}px`;
    popover.classList.add('visible');
    popover.setAttribute('aria-hidden', 'false');
    window.clearTimeout(popover._hideTimer);
    const timerId = window.setTimeout(() => {
      document.addEventListener('click', hidePopover, { once: true });
    }, 0);
    popover._hideTimer = timerId;
  }

  function hidePopover() {
    window.clearTimeout(elements.popover._hideTimer);
    elements.popover.classList.remove('visible');
    elements.popover.setAttribute('aria-hidden', 'true');
  }

  function normalisePopover(item) {
    if ('status' in item && 'health_score' in item) {
      return {
        title: item.name,
        subtitle: `${item.status} • Health ${item.health_score} • Risk ${item.risk_score}`,
        detail: `Last service ${formatDate(item.last_service)} · Next ${formatDate(item.next_service)}`,
      };
    }
    if (item.status && item.content) {
      return {
        title: item.name,
        subtitle: item.status,
        detail: `${item.content}${item.detail ? '<br />' + item.detail : ''}`,
      };
    }
    return {
      title: item.name || 'Details',
      subtitle: item.status || '',
      detail: item.detail || '',
    };
  }

  function applyTransform() {
    const { zoom, panX, panY } = state;
    elements.mapInner.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  }

  function handleZoom(event) {
    event.preventDefault();
    const delta = -event.deltaY;
    const zoomStep = delta > 0 ? 0.08 : -0.08;
    const newZoom = clamp(state.zoom + zoomStep, 0.6, 2.3);
    updateZoom(newZoom, event);
  }

  function updateZoom(newZoom, event) {
    const rect = elements.mapViewport.getBoundingClientRect();
    const pointer = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const world = {
      x: (pointer.x - state.panX) / state.zoom,
      y: (pointer.y - state.panY) / state.zoom,
    };
    state.zoom = newZoom;
    state.panX = pointer.x - world.x * state.zoom;
    state.panY = pointer.y - world.y * state.zoom;
    applyTransform();
  }

  function startPan(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    state.isPanning = true;
    state.panStart = { x: event.clientX, y: event.clientY };
    state.panOrigin = { x: state.panX, y: state.panY };
    elements.mapViewport.setPointerCapture(event.pointerId);
  }

  function panMove(event) {
    if (!state.isPanning) return;
    const dx = event.clientX - state.panStart.x;
    const dy = event.clientY - state.panStart.y;
    state.panX = state.panOrigin.x + dx;
    state.panY = state.panOrigin.y + dy;
    applyTransform();
  }

  function endPan(event) {
    if (!state.isPanning) return;
    state.isPanning = false;
    if (elements.mapViewport.hasPointerCapture(event.pointerId)) {
      elements.mapViewport.releasePointerCapture(event.pointerId);
    }
  }

  function daysUntil(date) {
    const now = new Date();
    const future = new Date(date);
    return Math.round((future - now) / (1000 * 60 * 60 * 24));
  }

  function daysSince(date) {
    const now = new Date();
    const past = new Date(date);
    return Math.round((now - past) / (1000 * 60 * 60 * 24));
  }

  function badgeFor(status) {
    if (!status) return '';
    if (status.toLowerCase().includes('critical')) return 'critical';
    if (status.toLowerCase().includes('warn') || status.toLowerCase().includes('risk')) {
      return 'warning';
    }
    if (status.toLowerCase().includes('good') || status.toLowerCase().includes('excellent')) {
      return 'healthy';
    }
    return '';
  }

  function formatTime(value) {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(value) {
    return new Date(value).toLocaleDateString();
  }

  function formatLabel(value) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function groupBy(items, fn) {
    return items.reduce((acc, item) => {
      const key = fn(item);
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return response.json();
  }
})();
