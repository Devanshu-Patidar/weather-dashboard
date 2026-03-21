const API_KEY = "e07a658e5d45c967a443c11cf3b4d0c6";
const API_BASE_URL = "https://api.openweathermap.org/data/2.5/weather";
const FORECAST_BASE_URL = "https://api.openweathermap.org/data/2.5/forecast";
const GEO_BASE_URL = "https://api.openweathermap.org/geo/1.0/direct";
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
let lastCoords = null;

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
    fetchAndRenderForecast(geo.selected.lat, geo.selected.lon, data.timezone);
    showStatus("", "info");
  } catch (error) {
    console.error(error);
    showStatus(error.message, "error");
  }
}

async function fetchWeatherByCoords(lat, lon, options = {}) {
  if (!validateApiKey()) return;
  if (!options.silent) {
    showStatus("Loading weather for your location...", "info");
  }
  renderCityMatches([]);
  try {
    const url = `${API_BASE_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
    const response = await fetch(url);
    if (!response.ok) {
      throw await buildReadableApiError(response);
    }
    const data = await response.json();
    if (!options.silent) {
      updateWeatherUI(data);
      fetchAndRenderForecast(lat, lon, data.timezone);
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
  if (iconCode) {
    weatherIconEl.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    weatherIconEl.alt = weatherDescription || "Weather icon";
    weatherIconEl.classList.remove("hidden");
  } else {
    weatherIconEl.classList.add("hidden");
  }
  const nowUtcSeconds = Math.floor(Date.now() / 1000);
  const localSeconds = nowUtcSeconds + (data.timezone || 0);
  const localDate = new Date(localSeconds * 1000);
  updatedTimeEl.textContent = `Last updated: ${formatDateTime(localDate)}`;
  lastCoords = { lat: data.coord?.lat, lon: data.coord?.lon };
  if (showGraphBtn) {
    showGraphBtn.disabled = !(lastCoords?.lat != null && lastCoords?.lon != null);
  }
  applyPreparationSuggestions({
    temp: temperature,
    feelsLike,
    main: weatherMain,
    description: weatherDescription,
    humidity,
    windSpeedKmh: Math.round(windSpeed * 3.6),
  });
}

function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.classList.remove("error", "info");
  if (type) {
    statusMessage.classList.add(type);
  }
}
function applyPreparationSuggestions(context) {
  const { temp, feelsLike, main, description, humidity, windSpeedKmh } = context;
  const outfit = buildOutfitSuggestion(temp, main, humidity, windSpeedKmh);
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
      "Your API key seems invalid or not yet active. Check the key in script.js, then wait a few minutes and try again." +
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
  if (!API_KEY || API_KEY === "YOUR_OPENWEATHERMAP_API_KEY_HERE") {
    showStatus(
      "Please add your OpenWeatherMap API key in script.js before using the app.",
      "error"
    );
    return false;
  }
  return true;
}

async function geocodeCity(input) {
  const parsed = parseCityQuery(input);
  const query = parsed.fullQuery;
  const url = `${GEO_BASE_URL}?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`;
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
        fetchAndRenderForecast(m.lat, m.lon, data.timezone);
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
  if ((!forecastGridEl && !hourlyTimelineEl) || !validateApiKey()) return;
  try {
    if (forecastGridEl) forecastGridEl.innerHTML = "";
    if (hourlyTimelineEl) hourlyTimelineEl.innerHTML = "";
    const url = `${FORECAST_BASE_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
    const response = await fetch(url);
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    if (!Array.isArray(data.list) || data.list.length === 0) {
      return;
    }
    const tz = timezoneOffsetSeconds ?? data.city?.timezone ?? 0;
    const daily = buildDailyForecastSummary(data.list, tz);
    renderForecast(daily);
    const hourly = build12HourTimeline(data.list, tz);
    renderHourlyTimeline(hourly);
  } catch {
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
      const iconEl = document.createElement("img");
      iconEl.className = "hourly-icon";
      iconEl.src = `https://openweathermap.org/img/wn/${item.icon}@2x.png`;
      iconEl.alt = item.description || "Forecast icon";
      card.appendChild(iconEl);
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
      const iconEl = document.createElement("img");
      iconEl.className = "forecast-day-icon";
      iconEl.src = `https://openweathermap.org/img/wn/${day.icon}@2x.png`;
      iconEl.alt = day.description || "Forecast icon";
      item.appendChild(iconEl);
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