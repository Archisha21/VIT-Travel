const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api";
const LS_KEY = "vit_rides_api_base_url";
const LS_REQUESTED_CODES = "vit_rides_requested_codes";
let allRides = [];

function getApiBaseUrl() {
  const stored = localStorage.getItem(LS_KEY);
  const selected = stored && stored.trim().length > 0 ? stored.trim() : DEFAULT_API_BASE_URL;
  return selected.endsWith("/") ? selected.slice(0, -1) : selected;
}

function setApiBaseUrl(url) {
  localStorage.setItem(LS_KEY, url);
}

function getRequestedCodes() {
  const raw = localStorage.getItem(LS_REQUESTED_CODES);
  if (!raw) return new Set();
  const arr = safeJsonParse(raw);
  if (!Array.isArray(arr)) return new Set();
  return new Set(arr.map((x) => String(x)));
}

function setRequestedCodes(set) {
  localStorage.setItem(LS_REQUESTED_CODES, JSON.stringify(Array.from(set)));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const msg = data && (data.error || data.message) ? data.error || data.message : text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function setMessage(el, text, kind) {
  el.textContent = text || "";
  el.classList.remove("ok", "err");
  if (kind) el.classList.add(kind);
}

function notifyUser(message) {
  if (message) window.alert(message);
}

function formatMaybeDate(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  } catch {
    return String(value);
  }
}

function rideCardHtml(ride) {
  const datetime = formatMaybeDate(ride.datetime);
  const rideCode = ride.public_id || "";
  const requestedCodes = getRequestedCodes();
  const isRequested = rideCode && requestedCodes.has(String(rideCode));
  const hasPrice =
    ride &&
    ride.min_price !== undefined &&
    ride.max_price !== undefined &&
    ride.min_price !== null &&
    ride.max_price !== null;
  const priceText = hasPrice ? `₹${escapeHtml(ride.min_price)} – ₹${escapeHtml(ride.max_price)}` : "—";
  const modeText = ride.transport_mode ? String(ride.transport_mode).toUpperCase() : "—";
  const numberText = ride.transport_number ? String(ride.transport_number) : "—";
  return `
    <div class="ride-card">
      <div class="ride-top">
        <div>
          <div class="ride-id">Ride #${ride.id}${rideCode ? ` · Code <strong>${escapeHtml(rideCode)}</strong>` : ""}</div>
          <div class="ride-route">${escapeHtml(ride.source)} → ${escapeHtml(ride.destination)}</div>
        </div>
        <div class="ride-id">Seats: ${ride.seats_available}</div>
      </div>

      <div class="ride-meta">
        <div><strong>Departure:</strong> ${escapeHtml(datetime)}</div>
        <div><strong>Mode:</strong> ${escapeHtml(modeText)} <span class="muted-inline">(${escapeHtml(numberText)})</span></div>
        <div><strong>Willing to pay:</strong> ${priceText}</div>
      </div>

      <div class="ride-actions">
        ${
          isRequested
            ? `<span class="badge badge-ok">Requested</span>`
            : `<button class="btn btn-primary" data-action="request" data-ride-id="${ride.id}">Request to Join</button>`
        }
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadRides() {
  const apiBaseUrl = getApiBaseUrl();
  const messageEl = document.getElementById("ridesListMessage");
  setMessage(messageEl, "Loading rides...", null);

  try {
    const payload = await fetchJson(`${apiBaseUrl}/rides/`);
    const rides = Array.isArray(payload) ? payload : Array.isArray(payload?.value) ? payload.value : [];
    allRides = rides;
    renderFilteredRides();
    setMessage(messageEl, "", null);
  } catch (err) {
    document.getElementById("ridesList").innerHTML = "";
    setMessage(
      messageEl,
      `Unable to fetch rides from ${apiBaseUrl}/rides/. ${err.message || String(err)}. Check backend server and API base URL.`,
      "err"
    );
  }
}

async function createRide(payload) {
  const apiBaseUrl = getApiBaseUrl();
  const messageEl = document.getElementById("createRideMessage");
  setMessage(messageEl, "Creating ride...", null);
  try {
    const data = await fetchJson(`${apiBaseUrl}/create/`, { method: "POST", body: JSON.stringify(payload) });
    setMessage(messageEl, data && data.id ? `Ride created (id: ${data.id}).` : "Ride created successfully.", "ok");
    notifyUser(data && data.id ? `Ride created successfully.\nRide ID: ${data.id}` : "Ride created successfully.");
    await loadRides();
    return data;
  } catch (err) {
    setMessage(messageEl, err.message || String(err), "err");
    notifyUser(`Create ride failed: ${err.message || String(err)}`);
    return null;
  }
}

async function requestRide(rideId) {
  const apiBaseUrl = getApiBaseUrl();
  const messageEl = document.getElementById("ridesListMessage");
  setMessage(messageEl, "Sending request...", null);

  try {
    const data = await fetchJson(`${apiBaseUrl}/request/${rideId}/`, { method: "POST", body: JSON.stringify({}) });
    const msg = data && (data.message || data.error) ? data.message || data.error : "Requested.";
    if (data && data.ride_code) {
      const requested = getRequestedCodes();
      requested.add(String(data.ride_code));
      setRequestedCodes(requested);
    }
    setMessage(messageEl, msg, data && data.error ? "err" : "ok");
    notifyUser(msg);
    await loadRides();
  } catch (err) {
    setMessage(messageEl, err.message || String(err), "err");
    notifyUser(`Request failed: ${err.message || String(err)}`);
  }
}

async function requestRideByCode(rideCode) {
  const apiBaseUrl = getApiBaseUrl();
  const messageEl = document.getElementById("requestByCodeMessage");
  setMessage(messageEl, "Sending request...", null);
  try {
    const data = await fetchJson(`${apiBaseUrl}/request-code/${encodeURIComponent(rideCode)}/`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const msg = data && (data.message || data.error) ? data.message || data.error : "Requested.";
    if (data && data.ride_code) {
      const requested = getRequestedCodes();
      requested.add(String(data.ride_code));
      setRequestedCodes(requested);
    }
    setMessage(messageEl, msg, data && data.error ? "err" : "ok");
    notifyUser(msg);
    await loadRides();
  } catch (err) {
    setMessage(messageEl, err.message || String(err), "err");
    notifyUser(`Request by code failed: ${err.message || String(err)}`);
  }
}

async function approveRequest(requestId) {
  const apiBaseUrl = getApiBaseUrl();
  const messageEl = document.getElementById("approveMessage");
  setMessage(messageEl, "Approving request...", null);

  try {
    const data = await fetchJson(`${apiBaseUrl}/approve/${requestId}/`, { method: "POST", body: JSON.stringify({}) });
    const msg = data && (data.message || data.error) ? data.message || data.error : "Approved.";
    setMessage(messageEl, msg, "ok");
    notifyUser(msg);
  } catch (err) {
    setMessage(messageEl, err.message || String(err), "err");
    notifyUser(`Approve failed: ${err.message || String(err)}`);
  }
}

function getActiveFilters() {
  const query = String(document.getElementById("filterTextInput")?.value || "").trim().toLowerCase();
  const mode = String(document.getElementById("filterModeSelect")?.value || "").trim().toLowerCase();
  const maxBudgetRaw = String(document.getElementById("filterMaxBudgetInput")?.value || "").trim();
  const minSeatsRaw = String(document.getElementById("filterMinSeatsInput")?.value || "").trim();
  const maxBudget = maxBudgetRaw === "" ? NaN : Number(maxBudgetRaw);
  const minSeats = minSeatsRaw === "" ? NaN : Number(minSeatsRaw);
  return {
    query,
    mode,
    hasMaxBudget: Number.isFinite(maxBudget),
    maxBudget,
    hasMinSeats: Number.isFinite(minSeats),
    minSeats,
  };
}

function renderFilteredRides() {
  const ridesList = document.getElementById("ridesList");
  const filters = getActiveFilters();
  const filtered = allRides.filter((ride) => {
    if (filters.query) {
      const hay = `${ride.source || ""} ${ride.destination || ""}`.toLowerCase();
      if (!hay.includes(filters.query)) return false;
    }
    if (filters.mode && String(ride.transport_mode || "").toLowerCase() !== filters.mode) return false;
    if (filters.hasMaxBudget && Number(ride.max_price) > filters.maxBudget) return false;
    if (filters.hasMinSeats && Number(ride.seats_available) < filters.minSeats) return false;
    return true;
  });
  ridesList.innerHTML = filtered.length > 0 ? filtered.map(rideCardHtml).join("") : "<p class='message'>No rides match the selected filters.</p>";
}

function init() {
  const apiBaseUrlInput = document.getElementById("apiBaseUrlInput");
  const saveApiBaseUrlBtn = document.getElementById("saveApiBaseUrlBtn");
  const reloadRidesBtn = document.getElementById("reloadRidesBtn");
  const createRideForm = document.getElementById("createRideForm");
  const approveRequestBtn = document.getElementById("approveRequestBtn");
  const requestRideCodeBtn = document.getElementById("requestRideCodeBtn");
  const applyFiltersBtn = document.getElementById("applyFiltersBtn");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");

  apiBaseUrlInput.value = getApiBaseUrl();

  saveApiBaseUrlBtn.addEventListener("click", () => {
    const value = apiBaseUrlInput.value.trim();
    if (!value) return;
    setApiBaseUrl(value);
    setMessage(document.getElementById("createRideMessage"), "API base URL saved.", "ok");
    loadRides();
  });

  reloadRidesBtn.addEventListener("click", () => loadRides());

  createRideForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(createRideForm);
    const source = String(form.get("source") || "").trim();
    const destination = String(form.get("destination") || "").trim();
    const seats_available = Number(form.get("seats_available"));
    const transport_mode = String(form.get("transport_mode") || "car").trim() || "car";
    const transport_number = String(form.get("transport_number") || "").trim();
    const min_price = Number(form.get("min_price"));
    const max_price = Number(form.get("max_price"));
    const datetimeLocal = String(form.get("datetime") || "");

    if (!source || !destination) return notifyUser("Please enter source and destination.");
    if (!Number.isFinite(seats_available) || seats_available < 0) return notifyUser("Please enter valid seats available.");
    if (!Number.isFinite(min_price) || min_price < 0) return notifyUser("Please enter valid minimum price.");
    if (!Number.isFinite(max_price) || max_price < 0) return notifyUser("Please enter valid maximum price.");
    if (max_price < min_price) return notifyUser("Max price must be greater than or equal to min price.");
    if (!datetimeLocal) return notifyUser("Please select date and time.");

    // Backend expects a Django DateTimeField; sending ISO 8601 works for DRF.
    // Note: datetime-local has no timezone; converting to ISO may shift by local offset.
    const datetime = new Date(datetimeLocal).toISOString();

    const created = await createRide({
      source,
      destination,
      seats_available,
      datetime,
      transport_mode,
      transport_number,
      min_price,
      max_price,
    });
    if (created) {
      createRideForm.reset();
      createRideForm.querySelector("select[name='transport_mode']").value = "car";
    }
  });

  document.getElementById("ridesList").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action='request']");
    if (!btn) return;
    const rideId = Number(btn.getAttribute("data-ride-id"));
    if (!Number.isFinite(rideId)) return;
    await requestRide(rideId);
  });

  requestRideCodeBtn.addEventListener("click", async () => {
    const input = document.getElementById("requestRideCodeInput");
    const code = String(input.value || "").trim().toUpperCase();
    if (!code) {
      setMessage(document.getElementById("requestByCodeMessage"), "Enter a ride code.", "err");
      notifyUser("Please enter a ride code.");
      return;
    }
    await requestRideByCode(code);
  });

  approveRequestBtn.addEventListener("click", async () => {
    const input = document.getElementById("approveRequestIdInput");
    const requestId = Number(input.value);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      setMessage(document.getElementById("approveMessage"), "Enter a valid request_id.", "err");
      notifyUser("Please enter a valid request id.");
      return;
    }
    await approveRequest(requestId);
  });

  applyFiltersBtn.addEventListener("click", () => {
    renderFilteredRides();
    notifyUser("Filters applied.");
  });

  clearFiltersBtn.addEventListener("click", () => {
    document.getElementById("filterTextInput").value = "";
    document.getElementById("filterModeSelect").value = "";
    document.getElementById("filterMaxBudgetInput").value = "";
    document.getElementById("filterMinSeatsInput").value = "";
    renderFilteredRides();
    notifyUser("Filters cleared.");
  });

  // Load rides on startup.
  loadRides();
}

document.addEventListener("DOMContentLoaded", init);

