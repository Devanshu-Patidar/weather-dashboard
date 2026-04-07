function getOpenWeatherApiKey() {
  try {
    const fromWindow = window.__OWM_API_KEY__;
    if (typeof fromWindow === "string" && fromWindow.trim() && fromWindow !== "YOUR_OPENWEATHERMAP_API_KEY_HERE") {
      return fromWindow.trim();
    }
  } catch {}
  try {
    const fromStorage = localStorage.getItem("OWM_API_KEY");
    if (typeof fromStorage === "string" && fromStorage.trim() && fromStorage !== "YOUR_OPENWEATHERMAP_API_KEY_HERE") {
      return fromStorage.trim();
    }
  } catch {}
  return "";
}

function ensureApiKeyOrExplain() {
  const key = getOpenWeatherApiKey();
  if (!key) {
    setStatus(
      "Missing OpenWeatherMap API key. Create `config.js` (copy from `config.example.js`) or set: localStorage.setItem('OWM_API_KEY','...')",
      true
    );
    return "";
  }
  return key;
}
const FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast";
const AIR_POLLUTION_URL = "https://api.openweathermap.org/data/2.5/air_pollution";
const WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather";
const OPEN_METEO_UV = "https://api.open-meteo.com/v1/forecast";
const AQI_LABELS = ["", "Good", "Satisfactory", "Moderate", "Poor", "Very Poor", "Severe"];
const AQI_DESCRIPTIONS = ["", "Good air quality.", "Satisfactory air quality.", "Moderate — sensitive people may be affected.", "Poor air quality.", "Very poor — health alert.", "Severe — health emergency."];
function pm25ToAQI(pm25) {
  if (pm25 == null || pm25 === undefined || isNaN(pm25)) return null;
  const c = Math.max(0, pm25);
  const breakpoints = [
    [0, 12, 0, 50],
    [12.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200],
    [150.5, 250.4, 201, 300],
    [250.5, 500.4, 301, 500],
  ];
  for (const [cLo, cHi, iLo, iHi] of breakpoints) {
    if (c >= cLo && c <= cHi) {
      return Math.round(((iHi - iLo) / (cHi - cLo)) * (c - cLo) + iLo);
    }
  }
  return c <= 500.4 ? 500 : null;
}
function aqiToCategory(aqi) {
  if (aqi == null || aqi <= 0) return { index: 0, label: "", desc: "" };
  if (aqi <= 50) return { index: 1, label: AQI_LABELS[1], desc: AQI_DESCRIPTIONS[1] };
  if (aqi <= 100) return { index: 2, label: AQI_LABELS[2], desc: AQI_DESCRIPTIONS[2] };
  if (aqi <= 150) return { index: 3, label: AQI_LABELS[3], desc: AQI_DESCRIPTIONS[3] };
  if (aqi <= 200) return { index: 4, label: AQI_LABELS[4], desc: AQI_DESCRIPTIONS[4] };
  if (aqi <= 300) return { index: 5, label: AQI_LABELS[5], desc: AQI_DESCRIPTIONS[5] };
  return { index: 6, label: AQI_LABELS[6], desc: AQI_DESCRIPTIONS[6] };
}
function getAQIFromAirData(airItem) {
  if (!airItem || !airItem.components) return null;
  const aqi25 = pm25ToAQI(airItem.components.pm2_5);
  const aqi10 = pm10ToAQI(airItem.components.pm10);
  if (aqi25 != null && aqi10 != null) return Math.max(aqi25, aqi10);
  return aqi25 != null ? aqi25 : aqi10;
}
function pm10ToAQI(pm10) {
  if (pm10 == null || pm10 === undefined || isNaN(pm10)) return null;
  const c = Math.max(0, pm10);
  const breakpoints = [
    [0, 54, 0, 50],
    [55, 154, 51, 100],
    [155, 254, 101, 150],
    [255, 354, 151, 200],
    [355, 424, 201, 300],
    [425, 604, 301, 500],
  ];
  for (const [cLo, cHi, iLo, iHi] of breakpoints) {
    if (c >= cLo && c <= cHi) {
      return Math.round(((iHi - iLo) / (cHi - cLo)) * (c - cLo) + iLo);
    }
  }
  return c <= 604 ? 500 : null;
}
if (typeof Chart !== "undefined" && typeof ChartDataLabels !== "undefined") {
  Chart.register(ChartDataLabels);
}
const params = new URLSearchParams(window.location.search);
const lat = params.get("lat");
const lon = params.get("lon");
const graphLocationEl = document.getElementById("graphLocation");
const aqiBigValueEl = document.getElementById("aqiBigValue");
const aqiDescEl = document.getElementById("aqiDesc");
const aqiMarkerEl = document.getElementById("aqiMarker");
const graphStatusEl = document.getElementById("graphStatus");
const graphThemeToggle = document.getElementById("graphThemeToggle");
const graphUvValueEl = document.getElementById("graphUvValue");
const graphUvSubEl = document.getElementById("graphUvSub");
const graphSunriseEl = document.getElementById("graphSunrise");
const graphSunsetEl = document.getElementById("graphSunset");

let tempChart = null;
let humidityChart = null;
let lastChartData = null;

function setStatus(msg, isError) {
  if (graphStatusEl) {
    graphStatusEl.textContent = msg || "";
    graphStatusEl.style.color = isError ? "#fecaca" : "#bfdbfe";
  }
}

function formatLocationClockFromUnix(utcUnixSeconds, timezoneOffsetSeconds) {
  if (utcUnixSeconds == null || timezoneOffsetSeconds == null) return "—";
  const d = new Date((utcUnixSeconds + timezoneOffsetSeconds) * 1000);
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function uvTierLabel(uvi) {
  if (uvi == null || Number.isNaN(uvi)) return "";
  if (uvi < 3) return "Low";
  if (uvi < 6) return "Moderate";
  if (uvi < 8) return "High";
  if (uvi < 11) return "Very high";
  return "Extreme";
}

async function fetchUvIndexOpenMeteo(lat, lon) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  try {
    const url = `${OPEN_METEO_UV}?latitude=${la}&longitude=${lo}&current=uv_index&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = await res.json();
    const uvi = j?.current?.uv_index;
    return typeof uvi === "number" && Number.isFinite(uvi) ? uvi : null;
  } catch {
    return null;
  }
}

/** Single-line labels for Chart.js (arrays become multi-line and crowd on mobile). */
function chartLayoutNarrow() {
  return typeof window !== "undefined" && window.innerWidth <= 576;
}

function formatChartTimeLabel(utcSeconds, tzOffset) {
  const d = new Date((utcSeconds + (tzOffset || 0)) * 1000);
  let hours = d.getUTCHours();
  const suffix = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const m = d.getUTCMinutes();
  if (m === 0) {
    return `${hours}${suffix}`;
  }
  return `${hours}:${m.toString().padStart(2, "0")}${suffix}`;
}

function shouldShowChartDataLabel(dataIndex, dataLength) {
  if (dataLength <= 8) return true;
  if (!chartLayoutNarrow()) return true;
  if (dataIndex === 0 || dataIndex === dataLength - 1) return true;
  const step = dataLength > 16 ? 4 : 3;
  return dataIndex % step === 0;
}

function formatTimeLabelWithDay(utcSeconds, tzOffset) {
  const tz = tzOffset || 0;
  const totalSeconds = utcSeconds + tz;
  const nowTotal = Math.floor(Date.now() / 1000) + tz;
  const dayPoint = Math.floor(totalSeconds / 86400);
  const dayNow = Math.floor(nowTotal / 86400);
  const hoursDate = new Date((utcSeconds + tz) * 1000);
  // Same reasoning as formatTimeLabel(): we already applied tz, so read UTC hours.
  let h = hoursDate.getUTCHours();
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const timeStr = `${h.toString().padStart(2, "0")}:00 ${suffix}`;
  const dayPrefix = dayPoint === dayNow ? "Today" : dayPoint === dayNow + 1 ? "Tomorrow" : "";
  return dayPrefix ? `${dayPrefix} ${timeStr}` : timeStr;
}

function interpolateTemp(list, timestamp) {
  if (!list || list.length === 0) return null;
  if (list.length === 1) return list[0].main?.temp ?? 0;
  const sorted = [...list].sort((a, b) => a.dt - b.dt);
  if (timestamp <= sorted[0].dt) return sorted[0].main?.temp ?? 0;
  if (timestamp >= sorted[sorted.length - 1].dt) return sorted[sorted.length - 1].main?.temp ?? 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (timestamp >= a.dt && timestamp <= b.dt) {
      const t = (timestamp - a.dt) / (b.dt - a.dt);
      const tempA = a.main?.temp ?? 0;
      const tempB = b.main?.temp ?? 0;
      return tempA + t * (tempB - tempA);
    }
  }
  return null;
}

function interpolateHumidity(list, timestamp) {
  if (!list || list.length === 0) return null;
  if (list.length === 1) return list[0].main?.humidity ?? 0;
  const sorted = [...list].sort((a, b) => a.dt - b.dt);
  if (timestamp <= sorted[0].dt) return sorted[0].main?.humidity ?? 0;
  if (timestamp >= sorted[sorted.length - 1].dt) return sorted[sorted.length - 1].main?.humidity ?? 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (timestamp >= a.dt && timestamp <= b.dt) {
      const t = (timestamp - a.dt) / (b.dt - a.dt);
      const hA = a.main?.humidity ?? 0;
      const hB = b.main?.humidity ?? 0;
      return Math.round(hA + t * (hB - hA));
    }
  }
  return null;
}

function buildHourly24h(list, tzOffset) {
  const now = Math.floor(Date.now() / 1000);
  const hourly = [];
  for (let i = 0; i < 24; i++) {
    const dt = now + i * 3600;
    const temp = interpolateTemp(list, dt);
    const humidity = interpolateHumidity(list, dt);
    if (temp != null) {
      hourly.push({
        dt,
        main: {
          temp: Math.round(temp * 10) / 10,
          humidity: humidity != null ? humidity : 0,
        },
      });
    }
  }
  return hourly;
}

async function fetchData() {
  const apiKey = ensureApiKeyOrExplain();
  if (!lat || !lon || !apiKey) {
    setStatus("Missing location. Search a city on the dashboard first.", true);
    return null;
  }
  setStatus("Loading real-time data...", false);
  try {
    const [forecastRes, airRes, weatherRes] = await Promise.all([
      fetch(`${FORECAST_URL}?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`),
      fetch(`${AIR_POLLUTION_URL}?lat=${lat}&lon=${lon}&appid=${apiKey}`),
      fetch(`${WEATHER_URL}?lat=${lat}&lon=${lon}&appid=${apiKey}`),
    ]);
    const forecast = forecastRes.ok ? await forecastRes.json() : null;
    const air = airRes.ok ? await airRes.json() : null;
    const weather = weatherRes.ok ? await weatherRes.json() : null;
    if (!forecast || !Array.isArray(forecast.list)) {
      setStatus("Could not load forecast.", true);
      return null;
    }
    setStatus("", false);
    return { forecast, air, weather };
  } catch (e) {
    setStatus("Failed to load data. Please try again.", true);
    return null;
  }
}

function build24hData(list, tzOffset) {
  const now = Math.floor(Date.now() / 1000);
  const end = now + 24 * 3600;
  const items = (list || [])
    .filter((e) => e && e.dt >= now && e.dt <= end)
    .sort((a, b) => a.dt - b.dt);
  if (items.length === 0) return (list || []).slice(0, 10);
  return items;
}

function isThemeLight() {
  return document.documentElement.classList.contains("theme-light");
}

function getChartColors() {
  const light = isThemeLight();
  return {
    tempLine: light ? "#0284c7" : "#38bdf8",
    tempFill: light ? "rgba(2, 132, 199, 0.15)" : "rgba(56, 189, 248, 0.2)",
    barBg: light ? "rgba(79, 70, 229, 0.6)" : "rgba(99, 102, 241, 0.6)",
    barBorder: light ? "#4f46e5" : "#6366f1",
    grid: light ? "rgba(107, 114, 128, 0.25)" : "rgba(148, 163, 184, 0.2)",
    gridX: light ? "rgba(107, 114, 128, 0.2)" : "rgba(148, 163, 184, 0.15)",
    ticks: light ? "#6b7280" : "#9ca3af",
  };
}

function renderTempChart(data, tzOffset) {
  const canvas = document.getElementById("tempChart");
  if (!canvas || !data || data.length === 0) return;
  const labels = data.map((e) => formatChartTimeLabel(e.dt, tzOffset));
  const nPoints = data.length;
  const temps = data
    .map((e) => (typeof e?.main?.temp === "number" ? Math.round(e.main.temp * 10) / 10 : null));
  const validTemps = temps.filter((t) => typeof t === "number" && Number.isFinite(t));
  const minT = validTemps.length ? Math.min(...validTemps) : 0;
  const maxT = validTemps.length ? Math.max(...validTemps) : 0;
  const pad = 5;
  const yMin = Math.max(-50, Math.floor(minT - pad));
  const yMax = Math.min(70, Math.ceil(maxT + pad));
  const c = getChartColors();
  // Highlight "now" (first point) on the graph
  const pointRadius = temps.map((_, i) => (i === 0 ? 6 : 3));
  const pointBorderWidth = temps.map((_, i) => (i === 0 ? 2 : 1));
  const pointBackgroundColor = temps.map((_, i) => (i === 0 ? "#f97316" : c.tempLine));
  const ctx = canvas.getContext("2d");
  if (tempChart) tempChart.destroy();
  const datalabelsPlugin = typeof ChartDataLabels !== "undefined";
  const narrow = chartLayoutNarrow();
  tempChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Temperature °C",
        data: temps,
        borderColor: c.tempLine,
        backgroundColor: c.tempFill,
        pointRadius,
        pointBorderWidth,
        pointBackgroundColor,
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      layout: { padding: narrow ? { top: 6, bottom: 2 } : { top: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: { intersect: false },
        datalabels: datalabelsPlugin ? {
          display: (ctx) => shouldShowChartDataLabel(ctx.dataIndex, nPoints),
          anchor: "end",
          align: "top",
          formatter: (v) => (v != null ? `${v}°` : ""),
          color: c.ticks,
          font: { size: narrow ? 8 : 10, weight: "500" },
        } : { display: false },
      },
      scales: {
        y: {
          beginAtZero: false,
          ...(validTemps.length ? { min: yMin, max: Math.max(yMin + 1, yMax) } : {}),
          grid: { color: c.grid },
          ticks: { color: c.ticks, font: { size: narrow ? 10 : 11 } },
        },
        x: {
          grid: { color: c.gridX },
          ticks: {
            color: c.ticks,
            maxRotation: narrow ? 0 : 40,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: narrow ? 6 : 14,
            font: { size: narrow ? 10 : 11 },
          },
        },
      },
    },
  });
}

function renderHumidityChart(data, tzOffset) {
  const canvas = document.getElementById("humidityChart");
  if (!canvas || !data || data.length === 0) return;
  const labels = data.map((e) => formatChartTimeLabel(e.dt, tzOffset));
  const nPoints = data.length;
  const hum = data.map((e) => e.main?.humidity ?? 0);
  const c = getChartColors();
  // Highlight "now" (first point) on the humidity graph
  const pointRadius = hum.map((_, i) => (i === 0 ? 6 : 3));
  const pointBorderWidth = hum.map((_, i) => (i === 0 ? 2 : 1));
  const pointBackgroundColor = hum.map((_, i) => (i === 0 ? "#f97316" : c.barBorder));
  const ctx = canvas.getContext("2d");
  if (humidityChart) humidityChart.destroy();
  const datalabelsPlugin = typeof ChartDataLabels !== "undefined";
  const narrow = chartLayoutNarrow();
  humidityChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Humidity",
        data: hum,
        borderColor: c.barBorder,
        backgroundColor: c.barBg.replace("0.6", "0.25"),
        pointRadius,
        pointBorderWidth,
        pointBackgroundColor,
        fill: true,
        tension: 0.3,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      layout: { padding: narrow ? { top: 6, bottom: 2 } : { top: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: { intersect: false },
        datalabels: datalabelsPlugin ? {
          display: (ctx) => shouldShowChartDataLabel(ctx.dataIndex, nPoints),
          anchor: "end",
          align: "top",
          formatter: (v) => (v != null ? String(v) : ""),
          color: c.ticks,
          font: { size: narrow ? 8 : 10, weight: "500" },
        } : { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: c.grid },
          ticks: { color: c.ticks, font: { size: narrow ? 10 : 11 } },
        },
        x: {
          grid: { color: c.gridX },
          ticks: {
            color: c.ticks,
            maxRotation: narrow ? 0 : 40,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: narrow ? 6 : 14,
            font: { size: narrow ? 10 : 11 },
          },
        },
      },
    },
  });
}

function renderAQI(airItem) {
  const aqi = airItem ? getAQIFromAirData(airItem) : null;
  if (aqi == null) {
    if (airItem && airItem.main && airItem.main.aqi) {
      const owmAqi = Math.min(5, Math.max(1, airItem.main.aqi));
      const fallbackVal = [0, 50, 100, 150, 250, 400][owmAqi];
      const fallbackDesc = ["", "Good air quality.", "Satisfactory air quality.", "Moderate — sensitive people may be affected.", "Poor air quality.", "Very poor — health alert."][owmAqi];
      if (aqiBigValueEl) aqiBigValueEl.textContent = fallbackVal;
      if (aqiDescEl) aqiDescEl.textContent = fallbackDesc;
      if (aqiMarkerEl) {
        aqiMarkerEl.style.left = `${(fallbackVal / 500) * 100}%`;
        aqiMarkerEl.style.display = "block";
      }
      return;
    }
    if (aqiBigValueEl) aqiBigValueEl.textContent = "--";
    if (aqiDescEl) aqiDescEl.textContent = "No air quality data.";
    if (aqiMarkerEl) aqiMarkerEl.style.display = "none";
    return;
  }
  const category = aqiToCategory(aqi);
  const pct = Math.min(100, (aqi / 500) * 100);
  if (aqiBigValueEl) aqiBigValueEl.textContent = aqi;
  if (aqiDescEl) aqiDescEl.textContent = category.desc;
  if (aqiMarkerEl) {
    aqiMarkerEl.style.left = `${pct}%`;
    aqiMarkerEl.style.display = "block";
  }
}

function setGraphTheme(mode) {
  const isLight = mode === "light";
  document.documentElement.classList.toggle("theme-light", isLight);
  if (graphThemeToggle) {
    graphThemeToggle.setAttribute("aria-label", isLight ? "Switch to night theme" : "Switch to day theme");
    graphThemeToggle.textContent = isLight ? "Night" : "Day";
  }
  try { localStorage.setItem("skysense-theme", isLight ? "light" : "dark"); } catch {}
  if (lastChartData) {
    renderTempChart(lastChartData.list, lastChartData.tz);
    renderHumidityChart(lastChartData.list, lastChartData.tz);
  }
}

function initGraphTheme() {
  try {
    const stored = localStorage.getItem("skysense-theme");
    if (stored === "light") setGraphTheme("light");
    else setGraphTheme("dark");
  } catch { setGraphTheme("dark"); }
}

if (graphThemeToggle) {
  graphThemeToggle.addEventListener("click", () => {
    const next = isThemeLight() ? "dark" : "light";
    setGraphTheme(next);
  });
}

async function init() {
  initGraphTheme();
  const result = await fetchData();
  if (!result) {
    return;
  }
  const { forecast, air, weather } = result;
  const tz = forecast?.city?.timezone ?? weather?.timezone ?? 0;
  if (graphLocationEl) {
    if (weather?.name) {
      graphLocationEl.textContent = `${weather.name}, ${weather.sys?.country ?? ""}`;
    } else {
      graphLocationEl.textContent = `Lat ${lat}, Lon ${lon}`;
    }
  }
  const uv = await fetchUvIndexOpenMeteo(lat, lon);
  if (graphUvValueEl) graphUvValueEl.textContent = uv != null ? uv.toFixed(1) : "—";
  if (graphUvSubEl) graphUvSubEl.textContent = uv != null ? uvTierLabel(uv) : "";
  if (graphSunriseEl) graphSunriseEl.textContent = formatLocationClockFromUnix(weather?.sys?.sunrise, tz);
  if (graphSunsetEl) graphSunsetEl.textContent = formatLocationClockFromUnix(weather?.sys?.sunset, tz);
  const list24 = build24hData(forecast.list, tz);
  const hourlyList = buildHourly24h(forecast.list || [], tz);
  const chartList = hourlyList.length >= 12 ? hourlyList : list24.length > 0 ? list24 : (forecast.list || []).slice(0, 8);
  lastChartData = { list: chartList, tz };
  renderTempChart(chartList, tz);
  renderHumidityChart(chartList, tz);
  renderAQI(air?.list?.[0] ?? null);
}

init();

let chartResizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(chartResizeTimer);
  chartResizeTimer = setTimeout(() => {
    if (lastChartData) {
      renderTempChart(lastChartData.list, lastChartData.tz);
      renderHumidityChart(lastChartData.list, lastChartData.tz);
    }
  }, 200);
});
