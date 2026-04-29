export const WEATHER_SOURCE_URL = 'https://www.accuweather.com/en';
import { fetchSecureJson, shouldUseSecureApi } from './secureProxy';

export const IMD_SOURCE_URL = 'https://mausam.imd.gov.in/index_en.php';
export const NESDIS_SOURCE_URL = 'https://www.nesdis.noaa.gov/';

const ACCUWEATHER_API_BASE = 'https://dataservice.accuweather.com';
const ACCUWEATHER_PUBLIC_BASE = 'https://www.accuweather.com';
const NOAA_CDO_API_BASE = 'https://www.ncei.noaa.gov/cdo-web/api/v2';

type AccuWeatherLocation = {
  Key: string;
  LocalizedName: string;
  EnglishName?: string;
  AdministrativeArea?: {
    LocalizedName?: string;
    EnglishName?: string;
  };
  Country?: {
    LocalizedName?: string;
    EnglishName?: string;
  };
};

type AccuWeatherCurrent = {
  LocalObservationDateTime?: string;
  WeatherText?: string;
  Temperature?: {
    Metric?: {
      Value?: number;
      Unit?: string;
    };
    Imperial?: {
      Value?: number;
      Unit?: string;
    };
  };
  RealFeelTemperature?: {
    Metric?: {
      Value?: number;
      Unit?: string;
    };
    Imperial?: {
      Value?: number;
      Unit?: string;
    };
  };
  RelativeHumidity?: number;
  UVIndex?: number;
  UVIndexText?: string;
  Visibility?: {
    Metric?: {
      Value?: number;
      Unit?: string;
    };
    Imperial?: {
      Value?: number;
      Unit?: string;
    };
  };
  CloudCover?: number;
  Pressure?: {
    Metric?: {
      Value?: number;
      Unit?: string;
    };
    Imperial?: {
      Value?: number;
      Unit?: string;
    };
  };
  Precip1hr?: {
    Metric?: {
      Value?: number;
      Unit?: string;
    };
    Imperial?: {
      Value?: number;
      Unit?: string;
    };
  };
  Wind?: {
    Direction?: {
      Localized?: string;
    };
    Speed?: {
      Metric?: {
        Value?: number;
        Unit?: string;
      };
      Imperial?: {
        Value?: number;
        Unit?: string;
      };
    };
  };
  AirAndPollen?: Array<{
    Name?: string;
    Category?: string;
  }>;
};

type AccuWeatherDailyForecast = {
  DailyForecasts?: Array<{
    Date?: string;
    Temperature?: {
      Minimum?: {
        Value?: number;
      };
      Maximum?: {
        Value?: number;
      };
    };
    Day?: {
      IconPhrase?: string;
      LongPhrase?: string;
    };
    Night?: {
      IconPhrase?: string;
      LongPhrase?: string;
    };
  }>;
};

export type WeatherDailyForecast = {
  label: string;
  minC: number;
  maxC: number;
  summary: string;
};

export type WeatherSummary = {
  locationQuery: string;
  location: string;
  observedAt: string;
  currentTempC: number;
  currentTempF: number;
  realFeelC: number;
  realFeelF: number;
  condition: string;
  wind: string;
  airQuality: string;
  humidity: string;
  uvIndex: string;
  cloudCover: string;
  visibility: string;
  pressure: string;
  precipitationLastHour: string;
  tonightLowC: number;
  tonightLowF: number;
  tomorrowHighC: number;
  tomorrowHighF: number;
  tomorrowSummary: string;
  dailyForecasts: WeatherDailyForecast[];
  accuweatherUrl: string;
  accuweatherSource: 'api' | 'page' | 'snapshot';
  source: 'live' | 'snapshot';
  nesdis: {
    title: string;
    summary: string;
    sourceUrl: string;
  };
  noaa: {
    status: 'available' | 'unavailable';
    summary: string;
    dataset?: string;
  };
};

type FetchWeatherOptions = {
  locationQuery?: string;
  signal?: AbortSignal;
};

const DEFAULT_LOCATION = 'Hapur, Uttar Pradesh';

const SNAPSHOT_SUMMARY: Omit<WeatherSummary, 'location' | 'locationQuery'> = {
  observedAt: '9:37 PM',
  currentTempC: 32,
  currentTempF: 89,
  realFeelC: 30,
  realFeelF: 86,
  condition: 'Hazy clouds',
  wind: 'N 11 km/h',
  airQuality: 'Unhealthy',
  humidity: '38%',
  uvIndex: '2 Low',
  cloudCover: '64%',
  visibility: '4 km',
  pressure: '1002 mb',
  precipitationLastHour: '0 mm',
  tonightLowC: 23,
  tonightLowF: 73,
  tomorrowHighC: 41,
  tomorrowHighF: 105,
  tomorrowSummary: 'Hazy and very hot; caution advised if outside for extended periods of time.',
  dailyForecasts: [
    { label: 'Today', minC: 23, maxC: 41, summary: 'Hazy and very hot' },
    { label: 'Tue', minC: 24, maxC: 40, summary: 'Hot with dry haze' },
    { label: 'Wed', minC: 25, maxC: 39, summary: 'Partly sunny and warm' },
    { label: 'Thu', minC: 24, maxC: 38, summary: 'Clouds increasing late' },
    { label: 'Fri', minC: 23, maxC: 37, summary: 'Slight shower chance' },
  ],
  accuweatherUrl: WEATHER_SOURCE_URL,
  accuweatherSource: 'snapshot',
  source: 'snapshot',
  nesdis: {
    title: 'Satellite context',
    summary: 'Satellite context suggests watching cloud bands and storm movement for the same area.',
    sourceUrl: NESDIS_SOURCE_URL,
  },
  noaa: {
    status: 'unavailable',
    summary: 'NOAA climate dataset context is not loaded for this fallback result.',
  },
};

function toFahrenheit(celsius: number) {
  return Math.round((celsius * 9) / 5 + 32);
}

function toCelsius(fahrenheit: number) {
  return Math.round(((fahrenheit - 32) * 5) / 9);
}

function roundValue(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
}

function getApiKey() {
  return import.meta.env.VITE_ACCUWEATHER_API_KEY?.trim() || '';
}

function getNoaaToken() {
  return import.meta.env.VITE_NOAA_TOKEN?.trim() || '';
}

export function hasAccuWeatherApiKey() {
  return Boolean(getApiKey());
}

function formatLocationLabel(locationQuery: string, location?: AccuWeatherLocation) {
  if (!location) {
    return locationQuery;
  }

  const city = location.LocalizedName || location.EnglishName || locationQuery;
  const adminArea = location.AdministrativeArea?.LocalizedName || location.AdministrativeArea?.EnglishName;
  const country = location.Country?.LocalizedName || location.Country?.EnglishName;

  return [city, adminArea, country].filter(Boolean).join(', ');
}

function buildNesdisSummary(location: string) {
  return {
    title: 'Satellite context',
    summary: `Satellite imagery context for ${location} suggests watching cloud build-up and storm movement trends.`,
    sourceUrl: 'https://www.nesdis.noaa.gov/imagery/interactive-maps/how-use-the-interactive-satellite-maps',
  };
}

function buildDefaultNoaaSummary() {
  return {
    status: 'unavailable' as const,
    summary: 'NOAA climate context was not available for this request.',
  };
}

async function fetchNoaaClimateContext(location: string, signal?: AbortSignal) {
  const token = getNoaaToken();

  if (!token) {
    return buildDefaultNoaaSummary();
  }

  try {
    const response = await fetch(`${NOAA_CDO_API_BASE}/datasets?limit=1&datasetid=GHCND`, {
      headers: { token },
      signal,
    });

    if (!response.ok) {
      return buildDefaultNoaaSummary();
    }

    const data = (await response.json()) as {
      results?: Array<{
        id?: string;
        name?: string;
        mindate?: string;
        maxdate?: string;
      }>;
    };
    const dataset = data.results?.[0];

    if (!dataset) {
      return buildDefaultNoaaSummary();
    }

    return {
      status: 'available' as const,
      dataset: dataset.id || 'GHCND',
      summary: `${dataset.name || 'Daily climate summaries'} available through NOAA from ${dataset.mindate || 'historical records'} to ${dataset.maxdate || 'recent records'} for climate cross-checking near ${location}.`,
    };
  } catch {
    return buildDefaultNoaaSummary();
  }
}

async function buildSnapshot(locationQuery: string, signal?: AbortSignal): Promise<WeatherSummary> {
  const location = locationQuery || DEFAULT_LOCATION;
  const noaa = await fetchNoaaClimateContext(location, signal);

  return {
    locationQuery: location,
    location,
    ...SNAPSHOT_SUMMARY,
    nesdis: buildNesdisSummary(location),
    noaa,
  };
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Weather fetch failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function resolveAccuWeatherLocation(locationQuery: string, signal?: AbortSignal) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('Missing VITE_ACCUWEATHER_API_KEY.');
  }

  const searchUrl =
    `${ACCUWEATHER_API_BASE}/locations/v1/cities/search` +
    `?apikey=${encodeURIComponent(apiKey)}` +
    `&q=${encodeURIComponent(locationQuery)}` +
    '&language=en-us&details=true';

  const locations = await fetchJson<AccuWeatherLocation[]>(searchUrl, signal);

  if (!locations.length) {
    throw new Error(`No AccuWeather location match found for ${locationQuery}.`);
  }

  return locations[0];
}

function formatWind(current: AccuWeatherCurrent) {
  const direction = current.Wind?.Direction?.Localized || '';
  const metricSpeed = current.Wind?.Speed?.Metric;

  if (metricSpeed?.Value) {
    return `${direction} ${Math.round(metricSpeed.Value)} ${metricSpeed.Unit || 'km/h'}`.trim();
  }

  const imperialSpeed = current.Wind?.Speed?.Imperial;
  if (imperialSpeed?.Value) {
    return `${direction} ${Math.round(imperialSpeed.Value)} ${imperialSpeed.Unit || 'mph'}`.trim();
  }

  return 'Not available';
}

function formatAirQuality(current: AccuWeatherCurrent) {
  const airQuality = current.AirAndPollen?.find((entry) =>
    (entry.Name || '').toLowerCase().includes('air')
  );

  return airQuality?.Category || 'Not available';
}

function formatHumidity(current: AccuWeatherCurrent) {
  return typeof current.RelativeHumidity === 'number' ? `${Math.round(current.RelativeHumidity)}%` : 'Not available';
}

function formatUvIndex(current: AccuWeatherCurrent) {
  if (typeof current.UVIndex === 'number') {
    return `${current.UVIndex}${current.UVIndexText ? ` ${current.UVIndexText}` : ''}`.trim();
  }

  return 'Not available';
}

function formatCloudCover(current: AccuWeatherCurrent) {
  return typeof current.CloudCover === 'number' ? `${Math.round(current.CloudCover)}%` : 'Not available';
}

function formatVisibility(current: AccuWeatherCurrent) {
  const metric = current.Visibility?.Metric;
  if (typeof metric?.Value === 'number') {
    return `${Math.round(metric.Value)} ${metric.Unit || 'km'}`;
  }

  const imperial = current.Visibility?.Imperial;
  if (typeof imperial?.Value === 'number') {
    return `${Math.round(imperial.Value)} ${imperial.Unit || 'mi'}`;
  }

  return 'Not available';
}

function formatPressure(current: AccuWeatherCurrent) {
  const metric = current.Pressure?.Metric;
  if (typeof metric?.Value === 'number') {
    return `${Math.round(metric.Value)} ${metric.Unit || 'mb'}`;
  }

  const imperial = current.Pressure?.Imperial;
  if (typeof imperial?.Value === 'number') {
    return `${Math.round(imperial.Value)} ${imperial.Unit || 'inHg'}`;
  }

  return 'Not available';
}

function formatPrecipitationLastHour(current: AccuWeatherCurrent) {
  const metric = current.Precip1hr?.Metric;
  if (typeof metric?.Value === 'number') {
    return `${metric.Value} ${metric.Unit || 'mm'}`;
  }

  const imperial = current.Precip1hr?.Imperial;
  if (typeof imperial?.Value === 'number') {
    return `${imperial.Value} ${imperial.Unit || 'in'}`;
  }

  return 'Not available';
}

function formatObservedAt(value?: string) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });
}

function formatForecastLabel(value: string | undefined, index: number) {
  if (!value) {
    return index === 0 ? 'Today' : `Day ${index + 1}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return index === 0 ? 'Today' : `Day ${index + 1}`;
  }

  return index === 0 ? 'Today' : date.toLocaleDateString([], { weekday: 'short' });
}

async function fetchFromAccuWeatherApi(locationQuery: string, signal?: AbortSignal): Promise<WeatherSummary> {
  const location = await resolveAccuWeatherLocation(locationQuery, signal);
  const apiKey = getApiKey();
  const currentUrl =
    `${ACCUWEATHER_API_BASE}/currentconditions/v1/${location.Key}` +
    `?apikey=${encodeURIComponent(apiKey)}` +
    '&details=true';
  const forecastUrl =
    `${ACCUWEATHER_API_BASE}/forecasts/v1/daily/5day/${location.Key}` +
    `?apikey=${encodeURIComponent(apiKey)}` +
    '&details=true&metric=true';

  const [currentConditions, forecast] = await Promise.all([
    fetchJson<AccuWeatherCurrent[]>(currentUrl, signal),
    fetchJson<AccuWeatherDailyForecast>(forecastUrl, signal),
  ]);

  const current = currentConditions[0];
  const daily = forecast.DailyForecasts?.[0];

  if (!current || !daily) {
    throw new Error('AccuWeather returned incomplete weather details.');
  }

  const currentTempC = roundValue(current.Temperature?.Metric?.Value, 0);
  const realFeelC = roundValue(current.RealFeelTemperature?.Metric?.Value, currentTempC);
  const tonightLowC = roundValue(daily.Temperature?.Minimum?.Value, currentTempC);
  const tomorrowHighC = roundValue(daily.Temperature?.Maximum?.Value, currentTempC);
  const locationLabel = formatLocationLabel(locationQuery, location);
  const noaa = await fetchNoaaClimateContext(locationLabel, signal);
  const dailyForecasts =
    forecast.DailyForecasts?.slice(0, 5).map((entry, index) => ({
      label: formatForecastLabel(entry.Date, index),
      minC: roundValue(entry.Temperature?.Minimum?.Value, currentTempC),
      maxC: roundValue(entry.Temperature?.Maximum?.Value, currentTempC),
      summary:
        entry.Day?.LongPhrase ||
        entry.Day?.IconPhrase ||
        entry.Night?.LongPhrase ||
        entry.Night?.IconPhrase ||
        'Forecast not available',
    })) || [];

  return {
    locationQuery,
    location: locationLabel,
    observedAt: formatObservedAt(current.LocalObservationDateTime),
    currentTempC,
    currentTempF: roundValue(current.Temperature?.Imperial?.Value, toFahrenheit(currentTempC)),
    realFeelC,
    realFeelF: roundValue(current.RealFeelTemperature?.Imperial?.Value, toFahrenheit(realFeelC)),
    condition: current.WeatherText || daily.Day?.IconPhrase || 'Not available',
    wind: formatWind(current),
    airQuality: formatAirQuality(current),
    humidity: formatHumidity(current),
    uvIndex: formatUvIndex(current),
    cloudCover: formatCloudCover(current),
    visibility: formatVisibility(current),
    pressure: formatPressure(current),
    precipitationLastHour: formatPrecipitationLastHour(current),
    tonightLowC,
    tonightLowF: toFahrenheit(tonightLowC),
    tomorrowHighC,
    tomorrowHighF: toFahrenheit(tomorrowHighC),
    tomorrowSummary: daily.Day?.LongPhrase || daily.Day?.IconPhrase || 'Forecast not available',
    dailyForecasts,
    accuweatherUrl: `${ACCUWEATHER_PUBLIC_BASE}/en/search-locations?query=${encodeURIComponent(locationLabel)}`,
    accuweatherSource: 'api',
    source: 'live',
    nesdis: buildNesdisSummary(locationLabel),
    noaa,
  };
}

function normalizePageText(value: string) {
  return value
    .replace(/ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°/g, 'Â°')
    .replace(/ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·/g, 'Â·')
    .replace(/RealFeelÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â®/g, 'RealFeelÂ®')
    .replace(/Ã‚Â°/g, 'Â°')
    .replace(/Ã‚Â®/g, 'Â®')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAccuWeatherUrl(rawText: string) {
  const fullMatch = rawText.match(/https?:\/\/www\.accuweather\.com\/en\/[^\s)"]+weather-forecast\/\d+/i);

  if (fullMatch?.[0]) {
    return fullMatch[0];
  }

  const relativeMatch = rawText.match(/\/en\/[^\s)"]+weather-forecast\/\d+/i);
  if (relativeMatch?.[0]) {
    return `${ACCUWEATHER_PUBLIC_BASE}${relativeMatch[0]}`;
  }

  return '';
}

async function fetchPublicAccuWeatherUrl(locationQuery: string, signal?: AbortSignal) {
  const searchUrl =
    `https://r.jina.ai/http://www.accuweather.com/en/search-locations?query=${encodeURIComponent(locationQuery)}`;
  const response = await fetch(searchUrl, { signal });

  if (!response.ok) {
    throw new Error(`AccuWeather public search failed: ${response.status}`);
  }

  const text = await response.text();
  return extractAccuWeatherUrl(text);
}

function parsePublicWeather(text: string, locationQuery: string, accuweatherUrl: string): WeatherSummary | null {
  const normalized = normalizePageText(text);
  const currentMatch =
    normalized.match(
      /Current Weather\s+([0-9:]+\s+[AP]M)\s+(\d+)Â°\s*F\s+RealFeelÂ®?\s+(\d+)Â°\s*(.+?)\s+More Details\s+Wind\s+(.+?)\s+Wind Gusts.*?Air Quality\s+([A-Za-z][A-Za-z\s-]+)/i
    ) ||
    normalized.match(
      /Current Weather\s+([0-9:]+\s+[AP]M)\s+(\d+)Â°\s*F\s+(.+?)\s+RealFeelÂ®?\s+(\d+)Â°\s*F?\s+Wind\s+(.+?)\s+Wind Gusts.*?Air Quality\s+([A-Za-z][A-Za-z\s-]+)/i
    );

  const tonightMatch =
    normalized.match(/Tonight'?s Weather.*?Lo:\s*(\d+)Â°\s*Tomorrow:\s*(.*?)\s*Hi:\s*(\d+)Â°/i) ||
    normalized.match(/Tonight.*?Lo:\s*(\d+)Â°.*?Tomorrow.*?Hi:\s*(\d+)Â°\s*(.*?)\s*(?:Hourly Weather|10-Day Weather Forecast)/i);

  const locationMatch =
    normalized.match(/Weather Forecasts \|\s*(.+?)\s+Weather Forecast/i) ||
    normalized.match(/Current Weather.*?in\s+(.+?)\s+Weather Forecast/i);

  if (!currentMatch || !tonightMatch) {
    return null;
  }

  const conditionFirst = currentMatch[3] && Number.isNaN(Number(currentMatch[3]));
  const currentTempF = Number(currentMatch[2]);
  const realFeelF = Number(conditionFirst ? currentMatch[4] : currentMatch[3]);
  const tonightLowF = Number(tonightMatch[1]);
  const tomorrowHighF = Number(tonightMatch[3] || tonightMatch[2]);
  const location = (locationMatch?.[1] || locationQuery).trim();

  return {
    locationQuery,
    location,
    observedAt: currentMatch[1],
    currentTempC: toCelsius(currentTempF),
    currentTempF,
    realFeelC: toCelsius(realFeelF),
    realFeelF,
    condition: (conditionFirst ? currentMatch[3] : currentMatch[4]).trim(),
    wind: currentMatch[5].trim(),
    airQuality: currentMatch[6].trim(),
    humidity: 'Not available',
    uvIndex: 'Not available',
    cloudCover: 'Not available',
    visibility: 'Not available',
    pressure: 'Not available',
    precipitationLastHour: 'Not available',
    tonightLowC: toCelsius(tonightLowF),
    tonightLowF,
    tomorrowHighC: toCelsius(tomorrowHighF),
    tomorrowHighF,
    tomorrowSummary: ((tonightMatch[2] || tonightMatch[3] || '').trim() || SNAPSHOT_SUMMARY.tomorrowSummary),
    dailyForecasts: SNAPSHOT_SUMMARY.dailyForecasts,
    accuweatherUrl,
    accuweatherSource: 'page',
    source: 'live',
    nesdis: buildNesdisSummary(location),
    noaa: buildDefaultNoaaSummary(),
  };
}

async function fetchFromAccuWeatherPage(locationQuery: string, signal?: AbortSignal): Promise<WeatherSummary> {
  const accuweatherUrl =
    (await fetchPublicAccuWeatherUrl(locationQuery, signal)) ||
    `${ACCUWEATHER_PUBLIC_BASE}/en/search-locations?query=${encodeURIComponent(locationQuery)}`;
  const proxiedUrl = `https://r.jina.ai/http://${accuweatherUrl.replace(/^https?:\/\//i, '')}`;
  const response = await fetch(proxiedUrl, { signal });

  if (!response.ok) {
    throw new Error(`AccuWeather page fetch failed: ${response.status}`);
  }

  const text = await response.text();
  const parsed = parsePublicWeather(text, locationQuery, accuweatherUrl);

  if (!parsed) {
    throw new Error('Unable to parse public AccuWeather weather page.');
  }

  return {
    ...parsed,
    noaa: await fetchNoaaClimateContext(parsed.location, signal),
  };
}

export function extractLocationFromPrompt(prompt: string) {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();

  const prepositionMatch = cleaned.match(
    /\b(?:in|for|at|near|around|of)\s+([A-Za-z][A-Za-z\s,-]{1,80})(?:\?|!|\.|,|$)/i
  );

  if (prepositionMatch?.[1]) {
    return prepositionMatch[1].trim().replace(/\s+(today|tomorrow|now)$/i, '');
  }

  const leadingMatch = cleaned.match(/^([A-Za-z][A-Za-z\s,-]{1,60})\s+(?:weather|forecast|temperature|rain|storm)/i);
  if (leadingMatch?.[1]) {
    return leadingMatch[1].trim();
  }

  return '';
}

export function buildWeatherContext(summary: WeatherSummary) {
  const dataStatus =
    summary.source === 'live'
      ? summary.accuweatherSource === 'api'
        ? 'Live city weather via API'
        : 'Live city weather via parsed public page'
      : 'Fallback snapshot estimate, not an exact live city reading';

  return [
    `Location: ${summary.location}`,
    `Data status: ${dataStatus}`,
    `Observed at: ${summary.observedAt}`,
    `Current: ${summary.currentTempC}°C / ${summary.currentTempF}°F`,
    `RealFeel: ${summary.realFeelC}°C / ${summary.realFeelF}°F`,
    `Condition: ${summary.condition}`,
    `Wind: ${summary.wind}`,
    `Air quality: ${summary.airQuality}`,
    `Humidity: ${summary.humidity}`,
    `UV index: ${summary.uvIndex}`,
    `Cloud cover: ${summary.cloudCover}`,
    `Visibility: ${summary.visibility}`,
    `Pressure: ${summary.pressure}`,
    `Precipitation last hour: ${summary.precipitationLastHour}`,
    `Tonight low: ${summary.tonightLowC}°C / ${summary.tonightLowF}°F`,
    `Tomorrow high: ${summary.tomorrowHighC}°C / ${summary.tomorrowHighF}°F`,
    `Tomorrow outlook: ${summary.tomorrowSummary}`,
    `5-day forecast: ${summary.dailyForecasts
      .map((day) => `${day.label} ${day.minC}-${day.maxC}°C ${day.summary}`)
      .join('; ')}`,
    `Satellite context: ${summary.nesdis.summary}`,
    `NOAA climate context: ${summary.noaa.summary}`,
  ].join('\n');
}

function localizeHindiWeatherPhrase(value: string) {
  const normalized = value.toLowerCase();

  if (/mostly sunny/.test(normalized)) return 'अधिकतर धूप';
  if (/partly sunny|partly cloudy/.test(normalized)) return 'आंशिक धूप/बादल';
  if (/sunny|clear/.test(normalized)) return 'धूप साफ';
  if (/cloud/.test(normalized)) return 'बादल';
  if (/rain|shower/.test(normalized)) return 'बारिश की संभावना';
  if (/thunder|storm/.test(normalized)) return 'आंधी-तूफान की संभावना';
  if (/haze|hazy/.test(normalized)) return 'धुंध/धूलभरी हवा';
  if (/fog/.test(normalized)) return 'कोहरा';
  if (/hot|heat/.test(normalized)) return 'गर्मी';
  if (/wind/.test(normalized)) return 'तेज हवा';

  return value;
}

function localizeTamilWeatherPhrase(value: string) {
  const normalized = value.toLowerCase();

  if (/not available|unavailable|n\/a/.test(normalized)) return 'கிடைக்கவில்லை';
  if (/intervals of clouds and sunshine.*wind|wind.*intervals of clouds and sunshine/.test(normalized)) {
    return 'மேகம் மற்றும் வெயில் மாறிமாறி; காற்று அதிகம்';
  }
  if (/plenty of sun.*(breezy|windy)|(?:breezy|windy).*plenty of sun/.test(normalized)) {
    return 'நல்ல வெயில்; காற்று அதிகம்';
  }
  if (/mostly sunny.*(breezy|windy)|(?:breezy|windy).*mostly sunny/.test(normalized)) {
    return 'பெரும்பாலும் வெயில்; காற்று அதிகம்';
  }
  if (/plenty of sun/.test(normalized)) return 'நல்ல வெயில்';
  if (/mostly sunny/.test(normalized)) return 'பெரும்பாலும் வெயில்';
  if (/intervals of clouds and sunshine/.test(normalized)) return 'மேகம் மற்றும் வெயில் மாறிமாறி';
  if (/partly sunny|partly cloudy/.test(normalized)) return 'பகுதி வெயில்/மேகம்';
  if (/sunny|clear/.test(normalized)) return 'வெயில் தெளிவு';
  if (/cloud|overcast/.test(normalized)) return 'மேகமூட்டம்';
  if (/rain|shower/.test(normalized)) return 'மழை வாய்ப்பு';
  if (/thunder|storm/.test(normalized)) return 'இடி/புயல் வாய்ப்பு';
  if (/haze|hazy/.test(normalized)) return 'மூடுபனி/தூசி மந்தம்';
  if (/fog/.test(normalized)) return 'மூடுபனி';
  if (/hot|heat/.test(normalized)) return 'அதிக வெப்பம்';
  if (/wind/.test(normalized)) return 'காற்று அதிகம்';

  return value;
}

function localizeTamilDayLabel(label: string) {
  const normalized = label.toLowerCase();
  const labels: Record<string, string> = {
    today: 'இன்று',
    mon: 'திங்கள்',
    monday: 'திங்கள்',
    tue: 'செவ்வாய்',
    tuesday: 'செவ்வாய்',
    wed: 'புதன்',
    wednesday: 'புதன்',
    thu: 'வியாழன்',
    thursday: 'வியாழன்',
    fri: 'வெள்ளி',
    friday: 'வெள்ளி',
    sat: 'சனி',
    saturday: 'சனி',
    sun: 'ஞாயிறு',
    sunday: 'ஞாயிறு',
  };

  return labels[normalized] || label;
}

export function formatWeatherResponse(summary: WeatherSummary, languageCode = 'en-IN') {
  const dataStatus =
    summary.source === 'live'
      ? summary.accuweatherSource === 'api'
        ? 'Live city weather'
        : 'Live city weather from public-page parsing'
      : 'Fallback snapshot estimate, not exact live city weather';

  if (languageCode === 'hi-IN') {
    const hindiDataStatus =
      summary.source === 'live'
        ? summary.accuweatherSource === 'api'
          ? 'लाइव शहर मौसम'
          : 'लाइव शहर मौसम'
        : 'Fallback अनुमान, exact live city weather नहीं';

    return [
      `${summary.location}`,
      `डेटा स्थिति: ${hindiDataStatus}`,
      `अवलोकन समय: ${summary.observedAt}`,
      `अभी तापमान: ${summary.currentTempC}°C / ${summary.currentTempF}°F`,
      `महसूस तापमान: ${summary.realFeelC}°C / ${summary.realFeelF}°F`,
      `मौसम: ${localizeHindiWeatherPhrase(summary.condition)}`,
      `हवा: ${summary.wind}`,
      `वायु गुणवत्ता: ${summary.airQuality}`,
      `नमी: ${summary.humidity}`,
      `UV सूचकांक: ${summary.uvIndex}`,
      `बादल: ${summary.cloudCover}`,
      `दृश्यता: ${summary.visibility}`,
      `दबाव: ${summary.pressure}`,
      `पिछले 1 घंटे की बारिश: ${summary.precipitationLastHour}`,
      `आज रात न्यूनतम: ${summary.tonightLowC}°C / ${summary.tonightLowF}°F`,
      `कल अधिकतम: ${summary.tomorrowHighC}°C / ${summary.tomorrowHighF}°F`,
      `आगे का अनुमान: ${localizeHindiWeatherPhrase(summary.tomorrowSummary)}`,
      `5 दिन: ${summary.dailyForecasts
        .map((day) => `${day.label} ${day.minC}-${day.maxC}°C ${localizeHindiWeatherPhrase(day.summary)}`)
        .join(' | ')}`,
      `NOAA: ${summary.noaa.status === 'available' ? 'climate cross-check उपलब्ध है' : 'climate context उपलब्ध नहीं है'}`,
    ].join('\n');
  }

  if (languageCode === 'ta-IN') {
    const tamilDataStatus =
      summary.source === 'live'
        ? summary.accuweatherSource === 'api'
          ? 'நேரடி நகர வானிலை'
          : 'நேரடி நகர வானிலை'
        : 'Fallback மதிப்பீடு; துல்லியமான நேரடி நகர வானிலை அல்ல';

    return [
      `${summary.location}`,
      `தரவு நிலை: ${tamilDataStatus}`,
      `பதிவு நேரம்: ${summary.observedAt}`,
      `தற்போதைய வெப்பநிலை: ${summary.currentTempC}°C / ${summary.currentTempF}°F`,
      `உணரப்படும் வெப்பநிலை: ${summary.realFeelC}°C / ${summary.realFeelF}°F`,
      `நிலைமை: ${localizeTamilWeatherPhrase(summary.condition)}`,
      `காற்று: ${summary.wind}`,
      `காற்றுத் தரம்: ${localizeTamilWeatherPhrase(summary.airQuality)}`,
      `ஈரப்பதம்: ${summary.humidity}`,
      `UV குறியீடு: ${summary.uvIndex}`,
      `மேக மூட்டம்: ${summary.cloudCover}`,
      `தெரிவு தூரம்: ${summary.visibility}`,
      `அழுத்தம்: ${summary.pressure}`,
      `கடந்த 1 மணி நேர மழை: ${summary.precipitationLastHour}`,
      `இன்றிரவு குறைந்தபட்சம்: ${summary.tonightLowC}°C / ${summary.tonightLowF}°F`,
      `நாளைய அதிகபட்சம்: ${summary.tomorrowHighC}°C / ${summary.tomorrowHighF}°F`,
      `முன்னோக்கு: ${localizeTamilWeatherPhrase(summary.tomorrowSummary)}`,
      `5 நாள் முன்னறிவிப்பு: ${summary.dailyForecasts
        .map(
          (day) => `${localizeTamilDayLabel(day.label)} ${day.minC}-${day.maxC}°C ${localizeTamilWeatherPhrase(day.summary)}`
        )
        .join(' | ')}`,
      `NOAA: ${summary.noaa.status === 'available' ? 'climate cross-check கிடைக்கிறது' : 'climate context கிடைக்கவில்லை'}`,
    ].join('\n');
  }

  return [
    `${summary.location}`,
    `Data Status: ${dataStatus}`,
    `Observed: ${summary.observedAt}`,
    `Current: ${summary.currentTempC}°C / ${summary.currentTempF}°F`,
    `RealFeel: ${summary.realFeelC}°C / ${summary.realFeelF}°F`,
    `Condition: ${summary.condition}`,
    `Wind: ${summary.wind}`,
    `Air Quality: ${summary.airQuality}`,
    `Humidity: ${summary.humidity}`,
    `UV Index: ${summary.uvIndex}`,
    `Cloud Cover: ${summary.cloudCover}`,
    `Visibility: ${summary.visibility}`,
    `Pressure: ${summary.pressure}`,
    `Precipitation (1h): ${summary.precipitationLastHour}`,
    `Tonight Low: ${summary.tonightLowC}°C / ${summary.tonightLowF}°F`,
    `Tomorrow High: ${summary.tomorrowHighC}°C / ${summary.tomorrowHighF}°F`,
    `Outlook: ${summary.tomorrowSummary}`,
    `5-Day: ${summary.dailyForecasts.map((day) => `${day.label} ${day.minC}-${day.maxC}°C`).join(' | ')}`,
    `NOAA: ${summary.noaa.summary}`,
  ].join('\n');
}
export async function fetchWeatherSummary(options: FetchWeatherOptions = {}): Promise<WeatherSummary> {
  const locationQuery = (options.locationQuery || DEFAULT_LOCATION).trim() || DEFAULT_LOCATION;

  try {
    if (shouldUseSecureApi()) {
      return await fetchSecureJson<WeatherSummary>(
        `/weather?location=${encodeURIComponent(locationQuery)}`,
        { signal: options.signal },
        15000
      );
    }
  } catch {
    // Fall through to public-page parsing or local development fallback.
  }

  try {
    if (getApiKey()) {
      return await fetchFromAccuWeatherApi(locationQuery, options.signal);
    }
  } catch {
    // Fall through to page parsing.
  }

  try {
    return await fetchFromAccuWeatherPage(locationQuery, options.signal);
  } catch {
    return buildSnapshot(locationQuery, options.signal);
  }
}


