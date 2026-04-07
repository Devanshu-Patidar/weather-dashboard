/* Meteocons (MIT) — assets/weather-icons/LICENSE */
const WEATHER_ICONS_BASE = "assets/weather-icons/";
const OWM_ICON_DIR = "openweathermap/";
const OWM_ICON_FALLBACK = "03d.svg";

function owmIconFilename(iconCode) {
  const c = String(iconCode || "").trim().toLowerCase();
  if (/^(0[1-9]|1[0-3]|50)[dn]$/.test(c)) {
    return `${c}.svg`;
  }
  return OWM_ICON_FALLBACK;
}

function weatherIconUrl(iconCode) {
  return `${WEATHER_ICONS_BASE}${OWM_ICON_DIR}${owmIconFilename(iconCode)}`;
}

function animatedWeatherIconHtml(iconCode) {
  const src = weatherIconUrl(iconCode);
  return `<div class="weather-icon-animated" aria-hidden="true"><object class="wx-meteocon" type="image/svg+xml" data="${src}"></object></div>`;
}

function setWeatherIconElement(el, iconCode, description) {
  if (!el) return;
  el.className = "weather-icon-animated";
  el.textContent = "";
  const obj = document.createElement("object");
  obj.className = "wx-meteocon";
  obj.type = "image/svg+xml";
  obj.data = weatherIconUrl(iconCode);
  obj.setAttribute("aria-label", description || "Weather conditions");
  el.appendChild(obj);
  el.removeAttribute("aria-hidden");
}

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
    showStatus(
      "Missing OpenWeatherMap API key. Create `config.js` (copy from `config.example.js`) or set: localStorage.setItem('OWM_API_KEY','...')",
      "error"
    );
    return "";
  }
  return key;
}
const API_BASE_URL = "https://api.openweathermap.org/data/2.5/weather";
const FORECAST_BASE_URL = "https://api.openweathermap.org/data/2.5/forecast";
const GEO_BASE_URL = "https://api.openweathermap.org/geo/1.0/direct";
const OPEN_METEO_UV = "https://api.open-meteo.com/v1/forecast";
const openDashboardBtn = document.getElementById("openDashboardBtn");
const themeToggleBtn = document.getElementById("themeToggle");
const dashboardSection = document.getElementById("dashboard");
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const locationBtn = document.getElementById("locationBtn");
const statusMessage = document.getElementById("statusMessage");
const cityMatchesEl = document.getElementById("cityMatches");
const locationNameEl = document.getElementById("locationName");
const temperatureEl = document.getElementById("temperature");
const weatherDescriptionEl = document.getElementById("weatherDescription");
const weatherIconEl = document.getElementById("weatherIcon");
const feelsLikeEl = document.getElementById("feelsLike");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const minMaxEl = document.getElementById("minMax");
const updatedTimeEl = document.getElementById("updatedTime");
const prepSummaryEl = document.getElementById("prepSummary");
const outfitSuggestionEl = document.getElementById("outfitSuggestion");
const activitySuggestionEl = document.getElementById("activitySuggestion");
const moodLineEl = document.getElementById("moodLine");
const forecastGridEl = document.getElementById("forecastGrid");
const hourlyTimelineEl = document.getElementById("hourlyTimeline");
const showGraphBtn = document.getElementById("showGraphBtn");
const uvIndexEl = document.getElementById("uvIndex");
const sunriseTimeEl = document.getElementById("sunriseTime");
const sunsetTimeEl = document.getElementById("sunsetTime");
const visibilityEl = document.getElementById("visibility");
const alertsListEl = document.getElementById("alertsList");
const notifySevereToggle = document.getElementById("notifySevereToggle");
const notifyHintEl = document.getElementById("notifyHint");
let lastCoords = null;
let lastPrepContext = null;

openDashboardBtn.addEventListener("click", () => {
  dashboardSection.scrollIntoView({ behavior: "smooth" });
});
if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.classList.contains("theme-light") ? "light" : "dark";
    const next = current === "light" ? "dark" : "light";
    setTheme(next);
  });
}
function setTheme(mode) {
  const isLight = mode === "light";
  document.documentElement.classList.toggle("theme-light", isLight);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = isLight ? "Night" : "Day";
  }
  try {
    localStorage.setItem("skysense-theme", isLight ? "light" : "dark");
  } catch {
  }
}
function initThemeFromStorage() {
  let stored = null;
  try {
    stored = localStorage.getItem("skysense-theme");
  } catch {
  }
  if (stored === "light" || stored === "dark") {
    setTheme(stored);
  } else {
    setTheme("dark");
  }
}
initThemeFromStorage();
initNotifyControls();
if (showGraphBtn) {
  showGraphBtn.addEventListener("click", () => {
    if (lastCoords && lastCoords.lat != null && lastCoords.lon != null) {
      window.location.href = `graph.html?lat=${lastCoords.lat}&lon=${lastCoords.lon}`;
    }
  });
}
searchBtn.addEventListener("click", () => {
  const city = cityInput.value.trim();
  if (!city) {
    showStatus("Please enter a city name first.", "error");
    return;
  }
  fetchWeatherByCity(city);
});
cityInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchBtn.click();
  }
});
locationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showStatus("Geolocation is not supported in this browser.", "error");
    return;
  }
  showStatus("Getting your location...", "info");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      fetchWeatherByCoords(latitude, longitude);
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        showStatus("Location permission denied. Please type your city instead.", "error");
      } else {
        showStatus("Could not get your location. Please try again or type a city.", "error");
      }
    }
  );
});
async function fetchWeatherByCity(city) {
  if (!validateApiKey()) return;
  showStatus(`Loading weather for "${city}"...`, "info");
  renderCityMatches([]);
  try {
    const geo = await geocodeCity(city);
    if (!geo) {
      showStatus(
        'Not found. Please search a city (example: "Manali, IN"). State-only searches like "Himachal Pradesh" may not work.',
        "error"
      );
      return;
    }
    if (geo.matches.length > 1) {
      renderCityMatches(geo.matches, geo.selectedKey);
    }
    const data = await fetchWeatherByCoords(geo.selected.lat, geo.selected.lon, { silent: true });
    updateWeatherUI(data, {
      overrideLocationName: formatGeoLabel(geo.selected),
    });
    const fl = await fetchAndRenderForecast(geo.selected.lat, geo.selected.lon, data.timezone);
    await updateUvAndAlerts(data, fl);
    showStatus("", "info");
  } catch (error) {
    console.error(error);
    showStatus(error.message, "error");
  }
}

async function fetchWeatherByCoords(lat, lon, options = {}) {
  const apiKey = ensureApiKeyOrExplain();
  if (!apiKey) return;
  if (!options.silent) {
    showStatus("Loading weather for your location...", "info");
  }
  renderCityMatches([]);
  try {
    const url = `${API_BASE_URL}?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    if (!response.ok) {
      throw await buildReadableApiError(response);
    }
    const data = await response.json();
    if (!options.silent) {
      updateWeatherUI(data);
      const fl = await fetchAndRenderForecast(lat, lon, data.timezone);
      await updateUvAndAlerts(data, fl);
      showStatus("", "info");
    }
    return data;
  } catch (error) {
    console.error(error);
    if (!options.silent) {
      showStatus(error.message, "error");
    }
    throw error;
  }
}

function updateWeatherUI(data, options = {}) {
  const cityName = options.overrideLocationName ?? `${data.name}, ${data.sys?.country ?? ""}`.trim();
  const temperature = Math.round(data.main.temp);
  const feelsLike = Math.round(data.main.feels_like);
  const humidity = data.main.humidity;
  const windSpeed = data.wind.speed;
  const minTemp = Math.round(data.main.temp_min);
  const maxTemp = Math.round(data.main.temp_max);
  const weatherMain = data.weather?.[0]?.main ?? "";
  const weatherDescription = data.weather?.[0]?.description ?? "";
  const iconCode = data.weather?.[0]?.icon ?? "";
  locationNameEl.textContent = cityName || "Unknown location";
  temperatureEl.textContent = `${temperature}°C`;
  weatherDescriptionEl.textContent = weatherDescription
    ? capitalizeFirstLetter(weatherDescription)
    : "No description available";
  feelsLikeEl.textContent = `${feelsLike}°C`;
  humidityEl.textContent = `${humidity}%`;
  windEl.textContent = `${Math.round(windSpeed * 3.6)} km/h`;
  minMaxEl.textContent = `${minTemp} / ${maxTemp} °C`;
  const tz = data.timezone ?? 0;
  if (sunriseTimeEl) sunriseTimeEl.textContent = formatLocationClockFromUnix(data.sys?.sunrise, tz);
  if (sunsetTimeEl) sunsetTimeEl.textContent = formatLocationClockFromUnix(data.sys?.sunset, tz);
  if (visibilityEl) visibilityEl.textContent = formatVisibilityMeters(data.visibility);
  if (uvIndexEl) uvIndexEl.textContent = "…";
  if (iconCode) {
    setWeatherIconElement(weatherIconEl, iconCode, weatherDescription || "Weather conditions");
    weatherIconEl.classList.remove("hidden");
  } else {
    weatherIconEl.innerHTML = "";
    weatherIconEl.className = "weather-icon-animated hidden";
    weatherIconEl.setAttribute("aria-hidden", "true");
  }
  const nowUtcSeconds = Math.floor(Date.now() / 1000);
  const localSeconds = nowUtcSeconds + (data.timezone || 0);
  const localDate = new Date(localSeconds * 1000);
  updatedTimeEl.textContent = `Last updated: ${formatDateTime(localDate)}`;
  lastCoords = { lat: data.coord?.lat, lon: data.coord?.lon };
  if (showGraphBtn) {
    showGraphBtn.disabled = !(lastCoords?.lat != null && lastCoords?.lon != null);
  }
  lastPrepContext = {
    temp: temperature,
    feelsLike,
    main: weatherMain,
    description: weatherDescription,
    humidity,
    windSpeedKmh: Math.round(windSpeed * 3.6),
    uvIndex: null,
  };
  applyPreparationSuggestions(lastPrepContext);
}

function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.classList.remove("error", "info");
  if (type) {
    statusMessage.classList.add(type);
  }
}
function applyPreparationSuggestions(context) {
  const { temp, feelsLike, main, description, humidity, windSpeedKmh, uvIndex } = context;
  let outfit = buildOutfitSuggestion(temp, main, humidity, windSpeedKmh);
  if (uvIndex != null && Number.isFinite(uvIndex)) {
    if (uvIndex >= 8) {
      outfit += " Strong sun (UV)—use SPF 30+ sunscreen, a hat, and shade during peak hours.";
    } else if (uvIndex >= 6) {
      outfit += " UV is elevated—sunscreen helps if you will be outside for a while.";
    }
  }
  const activity = buildActivitySuggestion(temp, main);
  const mood = buildMoodLine(temp, main, description);
  prepSummaryEl.textContent =
    "We read the temperature, humidity, wind and conditions, then translate that into simple, human language you can act on.";
  outfitSuggestionEl.textContent = outfit;
  activitySuggestionEl.textContent = activity;
  moodLineEl.textContent = mood;
}
function buildOutfitSuggestion(temp, main, humidity, windSpeedKmh) {
  if (temp <= 5) {
    return "Very cold: heavy jacket, hoodie inside, warm socks and maybe a beanie. Gloves if you stay out long.";
  }
  if (temp <= 15) {
    return "Chilly: light jacket or hoodie, full trousers and closed shoes are a good idea.";
  }
  if (temp >= 32) {
    return "Hot: light cotton t‑shirt, shorts or thin trousers, sunglasses and drink plenty of water.";
  }
  const isRainy = /rain|drizzle|thunderstorm/i.test(main);
  const isWindy = windSpeedKmh >= 25;
  const isHumid = humidity >= 70;

  if (isRainy) {
    return "Rainy: carry an umbrella or raincoat, waterproof shoes if possible, and avoid light-coloured shoes.";
  }

  if (isWindy) {
    return "Windy: a windbreaker or hoodie will help, and avoid loose hats or umbrellas in strong gusts.";
  }

  if (isHumid && temp >= 25) {
    return "Warm and humid: very light, breathable clothes and open shoes will keep you comfortable.";
  }

  return "Comfortable: casual t‑shirt/shirt with jeans or joggers is perfect. Add a light layer if you feel cold easily.";
}

function buildActivitySuggestion(temp, main) {
  const isRainy = /rain|drizzle|thunderstorm/i.test(main);
  const isSnow = /snow/i.test(main);
  const isClear = /clear/i.test(main);
  const isCloudy = /clouds/i.test(main);
  if (isSnow) {
    return "Snowy vibe: hot drink + short snowy walk, or cosy indoor gaming/OTT marathon.";
  }

  if (isRainy) {
    return "Perfect for indoor plans: movies, gaming, reading or catching up on a side project with some music.";
  }

  if (temp >= 34) {
    return "Too hot for heavy outdoor activity. Short evening walk or light cycling is fine; avoid intense afternoon workouts outside.";
  }

  if (isClear) {
    return "Clear skies: go for a walk, café meetup, quick run, or just sit outside and enjoy the light.";
  }

  if (isCloudy) {
    return "Cloudy but calm: great for a coffee run, light sports, or photo walk if you like moody skies.";
  }

  if (temp <= 10) {
    return "Cold weather: indoor workout, coding, reading or hanging out with friends at home works best.";
  }

  return "Balanced day: choose what fits your energy — short outdoor time plus some focused indoor work or study.";
}
function buildMoodLine(temp, main, description) {
  const base = description ? capitalizeFirstLetter(description) : main || "Weather";
  if (/thunderstorm/i.test(main)) {
    return `${base}. Dramatic sky energy — good day to stay mindful and move plans indoors if needed.`;
  }
  if (/rain|drizzle/i.test(main)) {
    return `${base}. Chill, lo‑fi playlist weather — slow down a bit and enjoy the sound of rain.`;
  }
  if (/snow/i.test(main)) {
    return `${base}. Soft, quiet mood outside — perfect for reflection and warm drinks.`;
  }
  if (/clear/i.test(main) && temp >= 24) {
    return `${base}. High‑energy, bright‑day mood — great for being active but remember to hydrate.`;
  }
  if (/clear/i.test(main)) {
    return `${base}. Simple, clean sky — light and focused mood for study or work.`;
  }
  if (/clouds/i.test(main)) {
    return `${base}. Calm, low‑contrast day — ideal for deep work, journaling or a relaxed meetup.`;
  }
  return `${base}. Tune the day to your pace — notice the weather, then choose what supports your energy.`;
}

function capitalizeFirstLetter(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatTime(date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDateTime(date) {
  const day = date.getDate().toString().padStart(2, "0");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[date.getMonth()] || "";
  const time = formatTime(date);
  return `${day} ${month}, ${time}`;
}

function formatLocationClockFromUnix(utcUnixSeconds, timezoneOffsetSeconds) {
  if (utcUnixSeconds == null || timezoneOffsetSeconds == null) return "--:--";
  const d = new Date((utcUnixSeconds + timezoneOffsetSeconds) * 1000);
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatVisibilityMeters(m) {
  if (m == null || m === undefined || Number.isNaN(m)) return "—";
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

function uvTierLabel(uvi) {
  if (uvi == null || Number.isNaN(uvi)) return "";
  if (uvi < 3) return "Low";
  if (uvi < 6) return "Moderate";
  if (uvi < 8) return "High";
  if (uvi < 11) return "Very high";
  return "Extreme";
}

function parseUvScalar(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickHourlyUvFromOpenMeteo(j) {
  const times = j?.hourly?.time;
  const uvs = j?.hourly?.uv_index;
  if (!Array.isArray(times) || !Array.isArray(uvs) || !times.length) return null;
  const now = Date.now();
  let best = null;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]).getTime();
    if (Number.isNaN(t)) continue;
    const diff = Math.abs(t - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = parseUvScalar(uvs[i]);
    }
  }
  return best;
}

async function fetchUvIndexOpenMeteo(lat, lon) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  try {
    const url = `${OPEN_METEO_UV}?latitude=${la}&longitude=${lo}&current=uv_index&hourly=uv_index&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = await res.json();
    if (j?.error) {
      console.warn("Open-Meteo:", j.reason || j.error);
      return null;
    }
    let uvi = parseUvScalar(j?.current?.uv_index);
    if (uvi == null) {
      uvi = pickHourlyUvFromOpenMeteo(j);
    }
    if (uvi == null && Array.isArray(j?.hourly?.uv_index) && j.hourly.uv_index.length) {
      uvi = parseUvScalar(j.hourly.uv_index[0]);
    }
    return uvi;
  } catch (e) {
    console.warn("Open-Meteo UV fetch failed:", e);
    return null;
  }
}

function buildWeatherAlerts(weather, forecastList, uvIndex) {
  const alerts = [];
  if (!weather) return alerts;

  const wid = weather.weather?.[0]?.id;
  const main = weather.weather?.[0]?.main ?? "";
  const desc = weather.weather?.[0]?.description ?? "";
  const windMs = weather.wind?.speed;
  const windKmh = typeof windMs === "number" ? Math.round(windMs * 3.6) : null;
  const temp = weather.main?.temp;

  const push = (level, id, tag, title, text, iconClass) => {
    alerts.push({ level, id, tag, title, text, iconClass });
  };

  if (typeof wid === "number") {
    if (wid >= 200 && wid < 300) {
      push("severe", "storm", "STORM WARNING", "Thunderstorm", "Thunderstorms in the area. Seek shelter, avoid open ground and tall trees, and stay updated.", "fa-solid fa-bolt");
    } else if (wid >= 502 && wid <= 504) {
      push("severe", "heavy-rain", "HEAVY RAIN WARNING", "Heavy rainfall", "Very heavy rainfall possible. Watch for water on roads and avoid low-lying areas.", "fa-solid fa-cloud-showers-heavy");
    } else if (wid >= 600 && wid <= 602) {
      push("warning", "snow", "WINTER ADVISORY", "Snow", "Snow or sleet — plan for slower travel and dress in warm layers.", "fa-solid fa-snowflake");
    } else if (wid >= 781 || wid === 900) {
      push("severe", "extreme", "EXTREME WEATHER", "Dangerous conditions", "Dangerous weather reported for this location. Follow official guidance.", "fa-solid fa-triangle-exclamation");
    }
  }

  if (/thunderstorm/i.test(main) && !alerts.some((a) => a.id === "storm")) {
    push("warning", "storm-soft", "STORM ADVISORY", "Stormy conditions", capitalizeFirstLetter(desc || main) + ". Stay aware if you are outdoors.", "fa-solid fa-cloud-bolt");
  }

  if (windKmh != null && windKmh >= 70) {
    push("severe", "wind-high", "HIGH WIND WARNING", "Very strong wind", `Winds around ${windKmh} km/h. Secure loose items and take care if driving.`, "fa-solid fa-wind");
  } else if (windKmh != null && windKmh >= 45) {
    push("warning", "wind", "WIND ADVISORY", "Strong wind", `Winds around ${windKmh} km/h — a jacket and caution on bridges or exposed paths help.`, "fa-solid fa-wind");
  }

  if (typeof temp === "number") {
    if (temp >= 38) {
      push("warning", "heat", "HEAT ADVISORY", "Extreme heat", "Very high temperature. Hydrate, avoid strenuous midday activity, and watch for heat stress.", "fa-solid fa-temperature-high");
    } else if (temp <= -8) {
      push("warning", "cold", "COLD ADVISORY", "Freezing cold", "Very low temperature. Layer up, cover skin, and limit time outside.", "fa-solid fa-temperature-low");
    }
  }

  if (uvIndex != null && uvIndex >= 11) {
    push("severe", "uv-extreme", "EXTREME UV ALERT", "Extreme UV", "UV is extreme. Minimize midday sun, use SPF 30+ sunscreen, hat, and shade.", "fa-solid fa-sun");
  } else if (uvIndex != null && uvIndex >= 8) {
    push("warning", "uv-high", "HIGH UV ADVISORY", "High UV", "UV is very high. Sunscreen, hat, and breaks in the shade are important today.", "fa-solid fa-sun");
  }

  const list = Array.isArray(forecastList) ? forecastList : [];
  const now = Math.floor(Date.now() / 1000);
  const soon = list.filter((e) => e && typeof e.dt === "number" && e.dt >= now && e.dt <= now + 6 * 3600);
  const rainSoon = soon.some((e) => {
    const id = e.weather?.[0]?.id;
    const m = e.weather?.[0]?.main ?? "";
    return (typeof id === "number" && id >= 500 && id < 600) || /rain|drizzle|thunderstorm/i.test(m);
  });
  if (rainSoon && !/rain|drizzle|thunderstorm/i.test(main)) {
    push("info", "rain-ahead", "RAIN OUTLOOK", "Rain expected soon", "Forecast suggests wet conditions in the next several hours. Carry cover if you head out.", "fa-solid fa-umbrella");
  }

  const order = { severe: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => order[a.level] - order[b.level]);
  return alerts;
}

function renderAlertsList(alerts) {
  if (!alertsListEl) return;
  alertsListEl.innerHTML = "";
  if (!alerts || alerts.length === 0) {
    const wrap = document.createElement("div");
    wrap.className = "wx-alerts-empty-state";
    const t = document.createElement("p");
    t.className = "wx-alerts-empty-title";
    t.textContent = "No active alerts";
    const d = document.createElement("p");
    d.className = "wx-alerts-empty-desc";
    d.textContent =
      "Load a location to see notices here. We surface types like storm or heavy rain warning when the live and forecast data match.";
    const chips = document.createElement("div");
    chips.className = "wx-alerts-demo-chips";
    chips.setAttribute("aria-hidden", "true");
    [["Storm", "wx-demo-severe"], ["Heavy rain warning", "wx-demo-warning"], ["High wind", "wx-demo-wind"]].forEach(([label, cls]) => {
      const s = document.createElement("span");
      s.className = `wx-demo-chip ${cls}`;
      s.textContent = label;
      chips.appendChild(s);
    });
    wrap.appendChild(t);
    wrap.appendChild(d);
    wrap.appendChild(chips);
    alertsListEl.appendChild(wrap);
    return;
  }
  alerts.forEach((a) => {
    const block = document.createElement("div");
    block.className = `wx-alert-block wx-alert-${a.level}`;
    const accent = document.createElement("div");
    accent.className = "wx-alert-accent";
    accent.setAttribute("aria-hidden", "true");
    const inner = document.createElement("div");
    inner.className = "wx-alert-inner";
    const top = document.createElement("div");
    top.className = "wx-alert-top";
    const pill = document.createElement("span");
    pill.className = "wx-alert-pill";
    pill.textContent = a.tag || "WEATHER NOTICE";
    const ic = document.createElement("i");
    ic.className = `wx-alert-icon ${a.iconClass || "fa-solid fa-circle-info"}`;
    ic.setAttribute("aria-hidden", "true");
    top.appendChild(pill);
    top.appendChild(ic);
    const headline = document.createElement("h4");
    headline.className = "wx-alert-headline";
    headline.textContent = a.title;
    const detail = document.createElement("p");
    detail.className = "wx-alert-detail";
    detail.textContent = a.text;
    inner.appendChild(top);
    inner.appendChild(headline);
    inner.appendChild(detail);
    block.appendChild(accent);
    block.appendChild(inner);
    alertsListEl.appendChild(block);
  });
}

function maybeBrowserNotify(alerts) {
  if (!notifySevereToggle?.checked) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const notable = alerts.filter((a) => a.level === "severe" || a.level === "warning");
  if (notable.length === 0) return;
  const key = notable.map((a) => a.id).sort().join("|");
  try {
    if (sessionStorage.getItem("skysense-notify-key") === key) return;
    sessionStorage.setItem("skysense-notify-key", key);
  } catch {
  }
  const first = notable[0];
  try {
    new Notification("SkySense — Weather Alerts", {
      body: `${first.title}: ${first.text}`.slice(0, 240),
      tag: "skysense-weather",
    });
  } catch {
  }
}

function updateNotifyHint() {
  if (!notifyHintEl) return;
  if (typeof Notification === "undefined") {
    notifyHintEl.textContent = "This browser does not support notifications.";
    return;
  }
  if (Notification.permission === "denied") {
    notifyHintEl.textContent = "Notifications are blocked for this site. Change it in browser settings if you want alerts.";
    return;
  }
  notifyHintEl.textContent = "";
}

function initNotifyControls() {
  updateNotifyHint();
  if (!notifySevereToggle) return;
  try {
    notifySevereToggle.checked = localStorage.getItem("skysense-notify-severe") === "1";
  } catch {
  }
  notifySevereToggle.addEventListener("change", async () => {
    try {
      localStorage.setItem("skysense-notify-severe", notifySevereToggle.checked ? "1" : "0");
    } catch {
    }
    if (notifySevereToggle.checked && typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
      }
    }
    updateNotifyHint();
  });
}

async function updateUvAndAlerts(weather, forecastList) {
  const lat = weather?.coord?.lat;
  const lon = weather?.coord?.lon;
  const uv = await fetchUvIndexOpenMeteo(lat, lon);
  if (uvIndexEl) {
    if (uv == null) uvIndexEl.textContent = "—";
    else {
      const tier = uvTierLabel(uv);
      uvIndexEl.textContent = `${uv.toFixed(1)} · ${tier}`;
    }
  }
  if (lastPrepContext) {
    applyPreparationSuggestions({ ...lastPrepContext, uvIndex: uv });
  }
  const alerts = buildWeatherAlerts(weather, forecastList, uv);
  renderAlertsList(alerts);
  maybeBrowserNotify(alerts);
}

async function buildReadableApiError(response) {
  let details = "";
  try {
    const body = await response.json();
    if (body && body.message) {
      details = ` (${body.message})`;
    }
  } catch {
  }
  if (response.status === 401) {
    return new Error(
      "Your API key seems invalid or not yet active. Check the key in config.js (or localStorage OWM_API_KEY), then wait a few minutes and try again." +
        details
    );
  }

  if (response.status === 404) {
    return new Error("City not found. Please check the spelling and try again." + details);
  }

  if (response.status === 429) {
    return new Error(
      "Too many requests to OpenWeatherMap right now. Please wait a bit and try again." + details
    );
  }

  return new Error("Failed to load weather data. Please try again later." + details);
}

function validateApiKey() {
  return Boolean(ensureApiKeyOrExplain());
}

async function geocodeCity(input) {
  const parsed = parseCityQuery(input);
  const query = parsed.fullQuery;
  const apiKey = ensureApiKeyOrExplain();
  if (!apiKey) return null;
  const url = `${GEO_BASE_URL}?q=${encodeURIComponent(query)}&limit=5&appid=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw await buildReadableApiError(response);
  }
  const results = await response.json();
  if (!Array.isArray(results) || results.length === 0) return null;
  const normalizedCountry = parsed.countryCode?.toUpperCase() ?? null;
  const selected = selectBestGeoMatch(results, normalizedCountry);
  const selectedKey = geoKey(selected);
  return {
    matches: results,
    selected,
    selectedKey,
  };
}

function parseCityQuery(input) {
  const raw = String(input || "").trim();
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const possibleCountry = parts[parts.length - 1];
    const isCountryCode = /^[a-zA-Z]{2}$/.test(possibleCountry);
    if (isCountryCode) {
      const cityPart = parts.slice(0, -1).join(", ");
      return { fullQuery: `${cityPart},${possibleCountry.toUpperCase()}`, countryCode: possibleCountry.toUpperCase() };
    }
  }
  return { fullQuery: raw, countryCode: null };
}

function selectBestGeoMatch(matches, countryCode) {
  if (countryCode) {
    const exact = matches.find((m) => (m.country || "").toUpperCase() === countryCode);
    if (exact) return exact;
  }
  const india = matches.find((m) => (m.country || "").toUpperCase() === "IN");
  if (india) return india;
  return matches[0];
}

function renderCityMatches(matches, selectedKey) {
  if (!cityMatchesEl) return;
  cityMatchesEl.innerHTML = "";
  if (!matches || matches.length <= 1) {
    cityMatchesEl.classList.add("hidden");
    return;
  }
  cityMatchesEl.classList.remove("hidden");
  const header = document.createElement("div");
  header.className = "city-matches-header";
  header.textContent = "Did you mean:";
  cityMatchesEl.appendChild(header);
  const list = document.createElement("div");
  list.className = "city-matches-list";
  matches.forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "city-match-btn";
    const key = geoKey(m);
    if (key === selectedKey) btn.classList.add("active");
    btn.textContent = formatGeoLabel(m);
    btn.addEventListener("click", async () => {
      try {
        showStatus(`Loading weather for "${btn.textContent}"...`, "info");
        const data = await fetchWeatherByCoords(m.lat, m.lon, { silent: true });
        updateWeatherUI(data, { overrideLocationName: formatGeoLabel(m) });
        const fl = await fetchAndRenderForecast(m.lat, m.lon, data.timezone);
        await updateUvAndAlerts(data, fl);
        renderCityMatches(matches, key);
        showStatus("", "info");
      } catch (e) {
        showStatus(e?.message || "Failed to load weather data. Please try again later.", "error");
      }
    });
    list.appendChild(btn);
  });
  cityMatchesEl.appendChild(list);
}

function formatGeoLabel(m) {
  const name = m?.name ?? "Unknown";
  const state = m?.state ? `, ${m.state}` : "";
  const country = m?.country ? `, ${m.country}` : "";
  return `${name}${state}${country}`;
}

function geoKey(m) {
  const name = (m?.name || "").toLowerCase();
  const state = (m?.state || "").toLowerCase();
  const country = (m?.country || "").toLowerCase();
  const lat = typeof m?.lat === "number" ? m.lat.toFixed(4) : "";
  const lon = typeof m?.lon === "number" ? m.lon.toFixed(4) : "";
  return `${name}|${state}|${country}|${lat}|${lon}`;
}
async function fetchAndRenderForecast(lat, lon, timezoneOffsetSeconds) {
  if ((!forecastGridEl && !hourlyTimelineEl) || !validateApiKey()) return [];
  const apiKey = ensureApiKeyOrExplain();
  if (!apiKey) return [];
  try {
    if (forecastGridEl) forecastGridEl.innerHTML = "";
    if (hourlyTimelineEl) hourlyTimelineEl.innerHTML = "";
    const url = `${FORECAST_BASE_URL}?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    if (!Array.isArray(data.list) || data.list.length === 0) {
      return [];
    }
    const tz = timezoneOffsetSeconds ?? data.city?.timezone ?? 0;
    const daily = buildDailyForecastSummary(data.list, tz);
    renderForecast(daily);
    const hourly = build12HourTimeline(data.list, tz);
    renderHourlyTimeline(hourly);
    return data.list;
  } catch {
    return [];
  }
}
function build12HourTimeline(list, timezoneOffsetSeconds) {
  const nowUtcSeconds = Math.floor(Date.now() / 1000);
  const points = (list || [])
    .filter((e) => e && typeof e.dt === "number" && typeof e.main?.temp === "number")
    .sort((a, b) => a.dt - b.dt);
  if (points.length === 0) return [];
  function findSurrounding(targetUtcSeconds) {
    let prev = null;
    let next = null;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.dt <= targetUtcSeconds) prev = p;
      if (p.dt >= targetUtcSeconds) {
        next = p;
        break;
      }
    }

    return { prev, next };
  }
  const items = [];
  for (let i = 0; i < 12; i++) {
    const targetUtcSeconds = nowUtcSeconds + i * 3600;
    const { prev, next } = findSurrounding(targetUtcSeconds);
    if (!prev && !next) continue;
    let temp = null;
    let chosenWeather = null;
    if (prev && next && prev !== next && typeof prev.main?.temp === "number" && typeof next.main?.temp === "number") {
      const span = next.dt - prev.dt;
      const t = span > 0 ? (targetUtcSeconds - prev.dt) / span : 0;
      const interp = prev.main.temp + (next.main.temp - prev.main.temp) * Math.min(1, Math.max(0, t));
      temp = Math.round(interp);
      chosenWeather = (t < 0.5 ? prev : next).weather?.[0] ?? null;
    } else {
      const src = next ?? prev;
      temp = typeof src?.main?.temp === "number" ? Math.round(src.main.temp) : null;
      chosenWeather = src?.weather?.[0] ?? null;
    }
    const localMillis = targetUtcSeconds * 1000 + (timezoneOffsetSeconds || 0) * 1000;
    const localDate = new Date(localMillis);
    items.push({
      timeLabel: i === 0 ? "Now" : formatTime(localDate),
      temp,
      icon: chosenWeather?.icon || "",
      description: chosenWeather?.description || "",
    });
  }
  return items;
}
function renderHourlyTimeline(items) {
  if (!hourlyTimelineEl) return;
  hourlyTimelineEl.innerHTML = "";
  if (!items || items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "forecast-summary";
    empty.textContent = "Timeline not available yet. Search a city to load it.";
    hourlyTimelineEl.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "hourly-item";
    const timeEl = document.createElement("div");
    timeEl.className = "hourly-time";
    timeEl.textContent = item.timeLabel || "--:--";
    card.appendChild(timeEl);
    if (item.icon) {
      const wrap = document.createElement("div");
      wrap.className = "hourly-icon-wrap";
      wrap.innerHTML = animatedWeatherIconHtml(item.icon);
      wrap.setAttribute("aria-hidden", "true");
      card.appendChild(wrap);
    }
    const tempEl = document.createElement("div");
    tempEl.className = "hourly-temp";
    tempEl.textContent = item.temp === null ? "--°C" : `${item.temp}°C`;
    card.appendChild(tempEl);
    const descEl = document.createElement("p");
    descEl.className = "hourly-desc";
    descEl.textContent = item.description ? capitalizeFirstLetter(item.description) : "";
    card.appendChild(descEl);
    hourlyTimelineEl.appendChild(card);
  });
}
function buildDailyForecastSummary(list, timezoneOffsetSeconds) {
  const byDate = new Map();
  list.forEach((entry) => {
    if (!entry || typeof entry.dt !== "number" || !entry.main) return;
    const utcMillis = entry.dt * 1000;
    const localMillis = utcMillis + (timezoneOffsetSeconds || 0) * 1000;
    const d = new Date(localMillis);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const dateKey = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    let bucket = byDate.get(dateKey);
    if (!bucket) {
      bucket = { temps: [], entries: [], date: new Date(localMillis) };
      byDate.set(dateKey, bucket);
    }
    bucket.temps.push(entry.main.temp_min, entry.main.temp_max);
    bucket.entries.push(entry);
  });
  const days = Array.from(byDate.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);
  return days.map((bucket) => {
    const minTemp = Math.round(Math.min(...bucket.temps));
    const maxTemp = Math.round(Math.max(...bucket.temps));
    const targetHour = 12;
    let chosen = bucket.entries[0];
    let bestDiff = Number.POSITIVE_INFINITY;
    bucket.entries.forEach((e) => {
      const utcMillis = e.dt * 1000;
      const localMillis = utcMillis + (timezoneOffsetSeconds || 0) * 1000;
      const h = new Date(localMillis).getUTCHours();
      const diff = Math.abs(h - targetHour);
      if (diff < bestDiff) {
        bestDiff = diff;
        chosen = e;
      }
    });
    const weather = chosen.weather?.[0] ?? {};
    return {
      date: bucket.date,
      min: minTemp,
      max: maxTemp,
      description: weather.description || "",
      icon: weather.icon || "",
    };
  });
}
function renderForecast(days) {
  if (!forecastGridEl) return;
  forecastGridEl.innerHTML = "";
  if (!days || days.length === 0) {
    return;
  }
  days.forEach((day, index) => {
    const item = document.createElement("div");
    item.className = "forecast-day";
    const labelEl = document.createElement("div");
    labelEl.className = "forecast-day-label";
    labelEl.textContent = index === 0 ? "Today" : formatWeekday(day.date);
    item.appendChild(labelEl);
    if (day.icon) {
      const wrap = document.createElement("div");
      wrap.className = "forecast-day-icon-wrap";
      wrap.innerHTML = animatedWeatherIconHtml(day.icon);
      wrap.setAttribute("aria-hidden", "true");
      item.appendChild(wrap);
    }
    const tempEl = document.createElement("div");
    tempEl.className = "forecast-day-temp";
    tempEl.textContent = `${day.min}° / ${day.max}°C`;
    item.appendChild(tempEl);
    const descEl = document.createElement("p");
    descEl.className = "forecast-day-desc";
    descEl.textContent = day.description ? capitalizeFirstLetter(day.description) : "";
    item.appendChild(descEl);
    forecastGridEl.appendChild(item);
  });
}
function formatWeekday(date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[date.getDay ? date.getDay() : new Date(date).getDay()];
}