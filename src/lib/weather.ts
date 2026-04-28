export const ACCUWEATHER_SOURCE_URL =
  'https://www.accuweather.com/';

const ACCUWEATHER_PROXY_URL =
  'https://r.jina.ai/http://www.accuweather.com/en/in/hapur/191058/weather-forecast/191058';

export type WeatherPoint = {
  label: string;
  temperatureF: number;
  precipitationChance: number;
};

export type WeatherSummary = {
  location: string;
  observedAt: string;
  currentTempF: number;
  realFeelF: number;
  condition: string;
  wind: string;
  airQuality: string;
  tonightLowF: number;
  tomorrowHighF: number;
  tomorrowSummary: string;
  hourly: WeatherPoint[];
  source: 'live' | 'snapshot';
};

const snapshotWeather: WeatherSummary = {
  location: 'Hapur, Uttar Pradesh',
  observedAt: '9:37 PM',
  currentTempF: 89,
  realFeelF: 86,
  condition: 'Hazy clouds',
  wind: 'N 7 mph',
  airQuality: 'Unhealthy',
  tonightLowF: 73,
  tomorrowHighF: 105,
  tomorrowSummary: 'Hazy and very hot; caution advised if outside for extended periods of time.',
  hourly: [
    { label: '10 PM', temperatureF: 86, precipitationChance: 0 },
    { label: '11 PM', temperatureF: 83, precipitationChance: 0 },
    { label: '12 AM', temperatureF: 81, precipitationChance: 0 },
    { label: '1 AM', temperatureF: 79, precipitationChance: 0 },
    { label: '2 AM', temperatureF: 78, precipitationChance: 0 },
    { label: '3 AM', temperatureF: 77, precipitationChance: 0 },
  ],
  source: 'snapshot',
};

function normalizeText(value: string) {
  return value
    .replace(/Â°/g, '°')
    .replace(/Â·/g, '·')
    .replace(/RealFeelÂ®/g, 'RealFeel®')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHourlySection(section: string) {
  const directMatches = [...section.matchAll(/(\d+\s+[AP]M)\s+(\d+)°\s+(\d+)%/g)];
  const labeledMatches = [...section.matchAll(/(\d+\s+[AP]M).*?(\d+)°.*?Precipitation\s+(\d+)%/g)];
  const matches = directMatches.length ? directMatches : labeledMatches;

  return matches.slice(0, 6).map((match) => ({
    label: match[1],
    temperatureF: Number(match[2]),
    precipitationChance: Number(match[3]),
  }));
}

function parseWeatherText(rawText: string): WeatherSummary | null {
  const text = normalizeText(rawText);

  const currentPatterns = [
    /Current Weather\s+([0-9:]+\s+[AP]M)\s+(\d+)°\s*F\s+RealFeel®?\s+(\d+)°\s*(.+?)\s+More Details\s+Wind\s+(.+?)\s+Wind Gusts.*?Air Quality\s+([A-Za-z][A-Za-z\s-]+)/i,
    /Current Weather\s+([0-9:]+\s+[AP]M)\s+(\d+)°\s*F\s+(.+?)\s+RealFeel®?\s+(\d+)°\s*F?\s+Wind\s+(.+?)\s+Wind Gusts.*?Air Quality\s+([A-Za-z][A-Za-z\s-]+)/i,
  ];

  const currentMatch = currentPatterns
    .map((pattern) => text.match(pattern))
    .find(Boolean);

  const tonightPatterns = [
    /Tonight'?s Weather.*?Lo:\s*(\d+)°\s*Tomorrow:\s*(.*?)\s*Hi:\s*(\d+)°/i,
    /Tonight.*?Lo:\s*(\d+)°.*?Tomorrow.*?Hi:\s*(\d+)°\s*(.*?)\s*(?:Hourly Weather|10-Day Weather Forecast)/i,
  ];

  const tonightMatch = tonightPatterns
    .map((pattern) => text.match(pattern))
    .find(Boolean);

  if (!currentMatch || !tonightMatch) {
    return null;
  }

  const isConditionFirstPattern = currentMatch[3] && Number.isNaN(Number(currentMatch[3]));
  const observedAt = currentMatch[1];
  const currentTempF = Number(currentMatch[2]);
  const realFeelF = Number(isConditionFirstPattern ? currentMatch[4] : currentMatch[3]);
  const condition = (isConditionFirstPattern ? currentMatch[3] : currentMatch[4]).trim();
  const wind = currentMatch[5].trim();
  const airQuality = currentMatch[6].trim();

  const tonightLowF = Number(tonightMatch[1]);
  const tomorrowHighF = Number(tonightMatch[3] || tonightMatch[2]);
  const tomorrowSummary = (tonightMatch[2] || tonightMatch[3] || '').trim();

  const hourlySection = text.split('Hourly Weather')[1]?.split('10-Day Weather Forecast')[0] || '';
  const hourly = parseHourlySection(hourlySection);

  return {
    location: 'Hapur, Uttar Pradesh',
    observedAt,
    currentTempF,
    realFeelF,
    condition,
    wind,
    airQuality,
    tonightLowF,
    tomorrowHighF,
    tomorrowSummary: tomorrowSummary || snapshotWeather.tomorrowSummary,
    hourly: hourly.length ? hourly : snapshotWeather.hourly,
    source: 'live',
  };
}

export async function fetchWeatherSummary(signal?: AbortSignal): Promise<WeatherSummary> {
  try {
    const response = await fetch(ACCUWEATHER_PROXY_URL, { signal });

    if (!response.ok) {
      throw new Error(`Weather fetch failed: ${response.status}`);
    }

    const rawText = await response.text();
    const parsed = parseWeatherText(rawText);

    if (!parsed) {
      throw new Error('Could not parse weather details from AccuWeather content.');
    }

    return parsed;
  } catch {
    return snapshotWeather;
  }
}
