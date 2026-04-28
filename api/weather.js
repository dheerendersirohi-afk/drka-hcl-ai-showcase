import { fetchJson, getQueryParam, handleOptions, requireEnv, sendJson } from './_utils.js';

const ACCUWEATHER_API_BASE = 'https://dataservice.accuweather.com';
const ACCUWEATHER_PUBLIC_BASE = 'https://www.accuweather.com';
const NOAA_CDO_API_BASE = 'https://www.ncei.noaa.gov/cdo-web/api/v2';
const NESDIS_SOURCE_URL = 'https://www.nesdis.noaa.gov/';

function toFahrenheit(celsius) {
  return Math.round((celsius * 9) / 5 + 32);
}

function roundValue(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
}

function formatLocationLabel(locationQuery, location) {
  const city = location.LocalizedName || location.EnglishName || locationQuery;
  const adminArea = location.AdministrativeArea?.LocalizedName || location.AdministrativeArea?.EnglishName;
  const country = location.Country?.LocalizedName || location.Country?.EnglishName;
  return [city, adminArea, country].filter(Boolean).join(', ');
}

function buildNesdisSummary(location) {
  return {
    title: 'Satellite context',
    summary: `Satellite imagery context for ${location} suggests watching cloud build-up and storm movement trends.`,
    sourceUrl: 'https://www.nesdis.noaa.gov/imagery/interactive-maps/how-use-the-interactive-satellite-maps',
  };
}

function buildDefaultNoaaSummary() {
  return {
    status: 'unavailable',
    summary: 'NOAA climate context was not available for this request.',
  };
}

async function fetchNoaaClimateContext(location) {
  const token = process.env.NOAA_TOKEN?.trim();

  if (!token) {
    return buildDefaultNoaaSummary();
  }

  try {
    const data = await fetchJson(
      `${NOAA_CDO_API_BASE}/datasets?limit=1&datasetid=GHCND`,
      { headers: { token } },
      12000
    );
    const dataset = data.results?.[0];

    if (!dataset) {
      return buildDefaultNoaaSummary();
    }

    return {
      status: 'available',
      dataset: dataset.id || 'GHCND',
      summary: `${dataset.name || 'Daily climate summaries'} available through NOAA from ${dataset.mindate || 'historical records'} to ${dataset.maxdate || 'recent records'} for climate cross-checking near ${location}.`,
    };
  } catch {
    return buildDefaultNoaaSummary();
  }
}

function formatWind(current) {
  const direction = current.Wind?.Direction?.Localized || '';
  const metricSpeed = current.Wind?.Speed?.Metric;

  if (typeof metricSpeed?.Value === 'number') {
    return `${direction} ${Math.round(metricSpeed.Value)} ${metricSpeed.Unit || 'km/h'}`.trim();
  }

  const imperialSpeed = current.Wind?.Speed?.Imperial;
  if (typeof imperialSpeed?.Value === 'number') {
    return `${direction} ${Math.round(imperialSpeed.Value)} ${imperialSpeed.Unit || 'mph'}`.trim();
  }

  return 'Not available';
}

function formatAirQuality(current) {
  const airQuality = current.AirAndPollen?.find((entry) =>
    (entry.Name || '').toLowerCase().includes('air')
  );

  return airQuality?.Category || 'Not available';
}

function formatMetric(metric, fallbackUnit) {
  if (typeof metric?.Value === 'number') {
    return `${Math.round(metric.Value)} ${metric.Unit || fallbackUnit}`;
  }

  return 'Not available';
}

function formatObservedAt(value) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });
}

function formatForecastLabel(value, index) {
  if (!value) {
    return index === 0 ? 'Today' : `Day ${index + 1}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return index === 0 ? 'Today' : `Day ${index + 1}`;
  }

  return index === 0 ? 'Today' : date.toLocaleDateString('en-IN', { weekday: 'short' });
}

async function resolveAccuWeatherLocation(locationQuery, apiKey) {
  const searchUrl =
    `${ACCUWEATHER_API_BASE}/locations/v1/cities/search` +
    `?apikey=${encodeURIComponent(apiKey)}` +
    `&q=${encodeURIComponent(locationQuery)}` +
    '&language=en-us&details=true';
  const locations = await fetchJson(searchUrl, {}, 12000);

  if (!Array.isArray(locations) || !locations.length) {
    const error = new Error(`No AccuWeather location match found for ${locationQuery}.`);
    error.status = 404;
    throw error;
  }

  return locations[0];
}

export default async function weather(req, res) {
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: { message: 'Use GET for weather.' } });
    return;
  }

  const locationQuery = getQueryParam(req, 'location', 'Hapur, Uttar Pradesh');

  try {
    const apiKey = requireEnv('ACCUWEATHER_API_KEY');
    const location = await resolveAccuWeatherLocation(locationQuery, apiKey);
    const currentUrl =
      `${ACCUWEATHER_API_BASE}/currentconditions/v1/${location.Key}` +
      `?apikey=${encodeURIComponent(apiKey)}` +
      '&details=true';
    const forecastUrl =
      `${ACCUWEATHER_API_BASE}/forecasts/v1/daily/5day/${location.Key}` +
      `?apikey=${encodeURIComponent(apiKey)}` +
      '&details=true&metric=true';

    const [currentConditions, forecast] = await Promise.all([
      fetchJson(currentUrl, {}, 12000),
      fetchJson(forecastUrl, {}, 12000),
    ]);
    const current = Array.isArray(currentConditions) ? currentConditions[0] : undefined;
    const daily = forecast.DailyForecasts?.[0];

    if (!current || !daily) {
      throw new Error('AccuWeather returned incomplete weather details.');
    }

    const currentTempC = roundValue(current.Temperature?.Metric?.Value, 0);
    const realFeelC = roundValue(current.RealFeelTemperature?.Metric?.Value, currentTempC);
    const tonightLowC = roundValue(daily.Temperature?.Minimum?.Value, currentTempC);
    const tomorrowHighC = roundValue(daily.Temperature?.Maximum?.Value, currentTempC);
    const locationLabel = formatLocationLabel(locationQuery, location);
    const noaa = await fetchNoaaClimateContext(locationLabel);
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

    sendJson(res, 200, {
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
      humidity:
        typeof current.RelativeHumidity === 'number'
          ? `${Math.round(current.RelativeHumidity)}%`
          : 'Not available',
      uvIndex:
        typeof current.UVIndex === 'number'
          ? `${current.UVIndex}${current.UVIndexText ? ` ${current.UVIndexText}` : ''}`.trim()
          : 'Not available',
      cloudCover:
        typeof current.CloudCover === 'number' ? `${Math.round(current.CloudCover)}%` : 'Not available',
      visibility: formatMetric(current.Visibility?.Metric, 'km'),
      pressure: formatMetric(current.Pressure?.Metric, 'mb'),
      precipitationLastHour: formatMetric(current.Precip1hr?.Metric, 'mm'),
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
    });
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: {
        message: error.message || 'Weather proxy failed.',
        sourceUrl: NESDIS_SOURCE_URL,
      },
    });
  }
};
