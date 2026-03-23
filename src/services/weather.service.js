const GEOCODING_BASE_URL =
    process.env.WEATHER_GEOCODING_URL || "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_BASE_URL =
    process.env.WEATHER_FORECAST_URL || "https://api.open-meteo.com/v1/forecast";
const WEATHER_TIMEOUT_MS = Number(process.env.WEATHER_TIMEOUT_MS || 8000);
const DEFAULT_COUNTRY_CODE = process.env.WEATHER_COUNTRY_CODE || "KE";
const DEFAULT_TIMEZONE = process.env.WEATHER_TIMEZONE || "Africa/Nairobi";
const DEFAULT_FORECAST_DAYS = Number(process.env.WEATHER_FORECAST_DAYS || 7);
const MAX_FORECAST_DAYS = Number(process.env.WEATHER_MAX_FORECAST_DAYS || 14);

const WEATHER_CODE_LABELS = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail"
};

const buildLocationQuery = ({ county, subcounty }) => subcounty || county || null;

const createAbortSignal = (timeoutMs) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return {
        signal: controller.signal,
        cleanup: () => clearTimeout(timeoutId)
    };
};

const fetchJson = async (url) => {
    const { signal, cleanup } = createAbortSignal(WEATHER_TIMEOUT_MS);

    try {
        const response = await fetch(url, { signal });
        if (!response.ok) {
            throw new Error(`Weather request failed with status ${response.status}`);
        }

        return response.json();
    } finally {
        cleanup();
    }
};

const getWeatherLabel = (code) => WEATHER_CODE_LABELS[code] || "Unknown";

const geocodeLocation = async ({ county, subcounty }) => {
    const locationQueries = [subcounty, county].filter(Boolean);

    for (const locationQuery of locationQueries) {
        const url = new URL(GEOCODING_BASE_URL);
        url.searchParams.set("name", locationQuery);
        url.searchParams.set("count", "1");
        url.searchParams.set("language", "en");
        url.searchParams.set("format", "json");
        url.searchParams.set("countryCode", DEFAULT_COUNTRY_CODE);

        const data = await fetchJson(url);
        const match = data.results?.[0] || null;

        if (match) {
            return {
                ...match,
                matched_query: locationQuery
            };
        }
    }

    return null;
};

const clampForecastDays = (days) => {
    const parsedDays = Number(days);

    if (!Number.isInteger(parsedDays) || parsedDays <= 0) {
        return DEFAULT_FORECAST_DAYS;
    }

    return Math.min(parsedDays, MAX_FORECAST_DAYS);
};

const fetchCurrentWeather = async ({ latitude, longitude, days }) => {
    const url = new URL(FORECAST_BASE_URL);
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,wind_speed_10m");
    url.searchParams.set(
        "daily",
        "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max"
    );
    url.searchParams.set("forecast_days", String(clampForecastDays(days)));
    url.searchParams.set("timezone", DEFAULT_TIMEZONE);

    return fetchJson(url);
};

const mapDailyForecast = (daily) => {
    const dates = daily.time || [];

    return dates.map((date, index) => {
        const weatherCode = daily.weather_code?.[index] ?? null;

        return {
            date,
            weather_code: weatherCode,
            condition: weatherCode === null ? "Unknown" : getWeatherLabel(weatherCode),
            temperature_max_c: daily.temperature_2m_max?.[index] ?? null,
            temperature_min_c: daily.temperature_2m_min?.[index] ?? null,
            apparent_temperature_max_c: daily.apparent_temperature_max?.[index] ?? null,
            apparent_temperature_min_c: daily.apparent_temperature_min?.[index] ?? null,
            precipitation_sum_mm: daily.precipitation_sum?.[index] ?? null,
            precipitation_probability_max_percent: daily.precipitation_probability_max?.[index] ?? null,
            wind_speed_max_kph: daily.wind_speed_10m_max?.[index] ?? null
        };
    });
};

export const getWeatherForLocation = async ({ county, subcounty, days }) => {
    if (!county && !subcounty) {
        return {
            available: false,
            reason: "missing_location"
        };
    }

    try {
        const geocoded = await geocodeLocation({ county, subcounty });
        if (!geocoded) {
            return {
                available: false,
                reason: "location_not_found",
                locationQuery: buildLocationQuery({ county, subcounty })
            };
        }

        const forecast = await fetchCurrentWeather({
            latitude: geocoded.latitude,
            longitude: geocoded.longitude,
            days
        });

        const current = forecast.current;
        if (!current) {
            return {
                available: false,
                reason: "missing_current_weather"
            };
        }

        const dailyForecast = forecast.daily ? mapDailyForecast(forecast.daily) : [];

        return {
            available: true,
            location: {
                name: geocoded.name,
                admin1: geocoded.admin1,
                country: geocoded.country,
                latitude: geocoded.latitude,
                longitude: geocoded.longitude
            },
            current: {
                observed_at: current.time,
                temperature_c: current.temperature_2m,
                apparent_temperature_c: current.apparent_temperature,
                humidity_percent: current.relative_humidity_2m,
                precipitation_mm: current.precipitation,
                rain_mm: current.rain,
                showers_mm: current.showers,
                wind_speed_kph: current.wind_speed_10m,
                weather_code: current.weather_code,
                condition: getWeatherLabel(current.weather_code)
            },
            forecast: dailyForecast
        };
    } catch (error) {
        console.error("Weather fetch error:", error);
        return {
            available: false,
            reason: "weather_fetch_failed"
        };
    }
};

const resolveWeatherPayload = (weatherData) => weatherData?.weather || weatherData || {};

export const normalizeWeatherData = (weatherData) => {
    const payload = resolveWeatherPayload(weatherData);
    const current = payload.current || {};

    return {
        temperature: current.temperature_c ?? current.temperature_2m ?? null,
        humidity: current.humidity_percent ?? current.relative_humidity_2m ?? null,
        rainfall: extractRainfall(payload)
    };
};

const sumRainfall = (values = []) =>
    values.reduce((sum, value) => sum + (Number(value) || 0), 0);

const extractRainfall = (data) => {
    if (Array.isArray(data.forecast) && data.forecast.length > 0) {
        return sumRainfall(
            data.forecast.slice(0, 3).map((day) => day?.precipitation_sum_mm)
        );
    }

    if (Array.isArray(data.daily?.precipitation_sum)) {
        return sumRainfall(data.daily.precipitation_sum.slice(0, 3));
    }

    if (data.current?.precipitation_mm != null) {
        return Number(data.current.precipitation_mm) || 0;
    }

    if (data.current?.rain_mm != null) {
        return Number(data.current.rain_mm) || 0;
    }

    if (data.current?.showers_mm != null) {
        return Number(data.current.showers_mm) || 0;
    }

    return 0;
};
