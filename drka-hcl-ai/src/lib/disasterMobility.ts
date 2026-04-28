import type { WeatherSummary } from './weather';
import { fetchSecureJson, shouldUseSecureApi } from './secureProxy';

export type MobilityStatus = 'normal' | 'watch' | 'disrupted' | 'unknown';

export type MobilityMode = {
  label: 'Flights' | 'Trains' | 'Highways' | 'Road blocks';
  status: MobilityStatus;
  impact: string;
  detail: string;
  updatedAt: string;
};

export type AviationFlight = {
  flightNumber: string;
  airline: string;
  status: string;
  departureAirport: string;
  arrivalAirport: string;
  scheduledDeparture: string;
};

export type AviationImpact = {
  status: 'live' | 'unavailable' | 'not-configured';
  airportCode: string;
  airportLabel: string;
  summary: string;
  flights: AviationFlight[];
};

export type DisasterMobilitySummary = {
  location: string;
  situation: string;
  status: 'live' | 'connector-ready';
  connectorNote: string;
  aviation: AviationImpact;
  modes: MobilityMode[];
  advisories: string[];
};

const MOBILITY_KEYWORDS = [
  'airport',
  'aviation',
  'block',
  'blocked',
  'bus',
  'cyclone',
  'delay',
  'disaster',
  'earthquake',
  'evacuation',
  'flight',
  'flood',
  'highway',
  'landslide',
  'metro',
  'rail',
  'rain',
  'road',
  'roadblock',
  'route',
  'storm',
  'traffic',
  'train',
  'transport',
  'travel',
  'tornado',
  'यातायात',
  'रेल',
  'सड़क',
  'बाढ़',
  'चक्रवात',
];

const HIGH_RISK_PATTERN = /cyclone|tornado|storm|thunder|squall|flood|landslide|earthquake|very heavy|extreme/i;
const WATCH_PATTERN = /rain|shower|wind|fog|low visibility|heat|humid|monsoon/i;
const AVIATIONSTACK_BASE_URL = 'https://api.aviationstack.com/v1';
const AVIATION_TIMEOUT_MS = 10000;

const AIRPORT_LOOKUP: Array<{ pattern: RegExp; code: string; label: string }> = [
  { pattern: /\b(delhi|new delhi|hapur|noida|gurugram|ghaziabad|faridabad)\b/i, code: 'DEL', label: 'Delhi NCR airport corridor' },
  { pattern: /\b(puducherry|puduchery|pondicherry|pondy)\b/i, code: 'PNY', label: 'Puducherry Airport' },
  { pattern: /\b(chennai|tamil nadu)\b/i, code: 'MAA', label: 'Chennai Airport' },
  { pattern: /\b(mumbai|maharashtra)\b/i, code: 'BOM', label: 'Mumbai Airport' },
  { pattern: /\b(bengaluru|bangalore|karnataka)\b/i, code: 'BLR', label: 'Bengaluru Airport' },
  { pattern: /\b(hyderabad|telangana)\b/i, code: 'HYD', label: 'Hyderabad Airport' },
  { pattern: /\b(kolkata|west bengal)\b/i, code: 'CCU', label: 'Kolkata Airport' },
  { pattern: /\b(ahmedabad|gujarat)\b/i, code: 'AMD', label: 'Ahmedabad Airport' },
  { pattern: /\b(kochi|ernakulam|kerala)\b/i, code: 'COK', label: 'Kochi Airport' },
  { pattern: /\b(lucknow|uttar pradesh)\b/i, code: 'LKO', label: 'Lucknow Airport' },
  { pattern: /\b(jaipur|rajasthan)\b/i, code: 'JAI', label: 'Jaipur Airport' },
  { pattern: /\b(bhubaneswar|odisha|orissa)\b/i, code: 'BBI', label: 'Bhubaneswar Airport' },
  { pattern: /\b(patna|bihar)\b/i, code: 'PAT', label: 'Patna Airport' },
  { pattern: /\b(pune)\b/i, code: 'PNQ', label: 'Pune Airport' },
  { pattern: /\b(goa|panaji)\b/i, code: 'GOI', label: 'Goa Airport' },
];

function getOptionalConnector(key: string) {
  const env = import.meta.env as Record<string, string | undefined>;
  return env[key]?.trim() || '';
}

function hasAnyLiveConnector() {
  return Boolean(
    getOptionalConnector('VITE_AVIATIONSTACK_API_KEY') ||
      getOptionalConnector('VITE_FLIGHT_STATUS_API_KEY') ||
      getOptionalConnector('VITE_RAIL_STATUS_API_KEY') ||
      getOptionalConnector('VITE_ROAD_TRAFFIC_API_KEY')
  );
}

function getAviationStackKey() {
  return getOptionalConnector('VITE_AVIATIONSTACK_API_KEY');
}

function resolveAirport(location: string) {
  const matched = AIRPORT_LOOKUP.find((item) => item.pattern.test(location));
  return matched || { code: 'DEL', label: 'Nearest configured airport corridor' };
}

function formatAviationTime(value?: string | null) {
  if (!value) {
    return 'Time not available';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

async function fetchAviationWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), AVIATION_TIMEOUT_MS);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchAviationImpact(location: string): Promise<AviationImpact> {
  const airport = resolveAirport(location);

  if (shouldUseSecureApi()) {
    try {
      return await fetchSecureJson<AviationImpact>(`/aviation?location=${encodeURIComponent(location)}`, {}, 12000);
    } catch (error) {
      return {
        status: 'unavailable',
        airportCode: airport.code,
        airportLabel: airport.label,
        summary: error instanceof Error ? error.message : 'Secure aviation data is unavailable right now.',
        flights: [],
      };
    }
  }

  const accessKey = getAviationStackKey();

  if (!accessKey) {
    return {
      status: 'not-configured',
      airportCode: airport.code,
      airportLabel: airport.label,
      summary: 'AviationStack key is not configured, so flight data is estimated only.',
      flights: [],
    };
  }

  try {
    const params = new URLSearchParams({
      access_key: accessKey,
      dep_iata: airport.code,
      limit: '5',
    });
    const response = await fetchAviationWithTimeout(`${AVIATIONSTACK_BASE_URL}/flights?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`AviationStack returned ${response.status}`);
    }

    const payload = (await response.json()) as {
      error?: { message?: string };
      data?: Array<{
        flight_status?: string;
        airline?: { name?: string };
        flight?: { iata?: string; number?: string };
        departure?: { airport?: string; iata?: string; scheduled?: string };
        arrival?: { airport?: string; iata?: string };
      }>;
    };

    if (payload.error) {
      throw new Error(payload.error.message || 'AviationStack request failed');
    }

    const flights = (payload.data || []).slice(0, 5).map((flight) => ({
      flightNumber: flight.flight?.iata || flight.flight?.number || 'Unknown flight',
      airline: flight.airline?.name || 'Unknown airline',
      status: flight.flight_status || 'unknown',
      departureAirport: flight.departure?.airport || flight.departure?.iata || airport.code,
      arrivalAirport: flight.arrival?.airport || flight.arrival?.iata || 'Arrival not available',
      scheduledDeparture: formatAviationTime(flight.departure?.scheduled),
    }));

    return {
      status: 'live',
      airportCode: airport.code,
      airportLabel: airport.label,
      summary: flights.length
        ? `Live AviationStack sample found ${flights.length} departure record(s) for ${airport.code}.`
        : `AviationStack is connected, but no departure records were returned for ${airport.code}.`,
      flights,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      airportCode: airport.code,
      airportLabel: airport.label,
      summary: error instanceof Error ? error.message : 'AviationStack flight data is unavailable right now.',
      flights: [],
    };
  }
}

function inferSituation(prompt: string, weatherSummary?: WeatherSummary) {
  const condition = weatherSummary?.condition || prompt;
  const combined = `${prompt} ${condition} ${weatherSummary?.tomorrowSummary || ''}`;

  if (HIGH_RISK_PATTERN.test(combined)) {
    return 'Potential disaster or severe weather disruption';
  }

  if (WATCH_PATTERN.test(combined)) {
    return 'Weather watch with possible movement delays';
  }

  return 'No confirmed live disaster trigger detected';
}

function inferStatus(prompt: string, weatherSummary?: WeatherSummary): MobilityStatus {
  const combined = `${prompt} ${weatherSummary?.condition || ''} ${weatherSummary?.tomorrowSummary || ''}`;

  if (HIGH_RISK_PATTERN.test(combined)) {
    return 'disrupted';
  }

  if (WATCH_PATTERN.test(combined)) {
    return 'watch';
  }

  return 'unknown';
}

function modeStatus(baseStatus: MobilityStatus, mode: MobilityMode['label']): MobilityStatus {
  if (baseStatus === 'disrupted') {
    return mode === 'Road blocks' ? 'watch' : 'disrupted';
  }

  if (baseStatus === 'watch') {
    return 'watch';
  }

  return 'unknown';
}

function buildMode(
  label: MobilityMode['label'],
  baseStatus: MobilityStatus,
  location: string,
  updatedAt: string
): MobilityMode {
  const status = modeStatus(baseStatus, label);

  const details: Record<MobilityMode['label'], string> = {
    Flights:
      status === 'disrupted'
        ? `Airport movement near ${location} may face delays, diversions, or cancellations if visibility/wind/rain worsens.`
        : `Airport movement near ${location} should be checked against live departure and arrival boards.`,
    Trains:
      status === 'disrupted'
        ? `Rail services around ${location} may slow down because of waterlogging, track safety checks, or signal disruption.`
        : `Rail status for ${location} is connector-ready; verify live station advisories before dispatch decisions.`,
    Highways:
      status === 'disrupted'
        ? `Highways and arterial roads near ${location} may need rerouting around flood-prone or wind-exposed corridors.`
        : `Highway status for ${location} is connector-ready; use live traffic feeds when available.`,
    'Road blocks':
      status === 'disrupted'
        ? `Road-block confirmation needs police, highway authority, or field-team reports before marking routes closed.`
        : `No verified road-block feed is connected yet for ${location}; field reports can be attached through RAG/manual updates.`,
  };

  const impact: Record<MobilityStatus, string> = {
    disrupted: 'High impact',
    normal: 'Normal',
    unknown: label === 'Flights' ? 'Live sample available' : 'Connector-ready',
    watch: 'Watch',
  };

  return {
    label,
    status,
    impact: impact[status],
    detail: details[label],
    updatedAt,
  };
}

export function isDisasterMobilityContent(content: string) {
  const lowered = content.toLowerCase();
  return MOBILITY_KEYWORDS.some((keyword) => lowered.includes(keyword.toLowerCase()));
}

export async function buildDisasterMobilitySummary({
  locationQuery,
  weatherSummary,
}: {
  locationQuery: string;
  weatherSummary?: WeatherSummary;
}): Promise<DisasterMobilitySummary> {
  const location = weatherSummary?.location || locationQuery.trim() || 'the requested location';
  const baseStatus = inferStatus(locationQuery, weatherSummary);
  const updatedAt = new Date().toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const aviation = await fetchAviationImpact(location);
  const status = aviation.status === 'live' || hasAnyLiveConnector() ? 'live' : 'connector-ready';

  return {
    location,
    situation: inferSituation(locationQuery, weatherSummary),
    status,
    connectorNote:
      aviation.status === 'live'
        ? 'AviationStack flight data is connected. Rail, highway, and road-block feeds still need official connectors.'
        : status === 'live'
          ? 'One or more transport connectors are configured, but aviation data was not available for this request.'
          : 'Live flight, rail, and road-block connectors are not configured yet, so this is an operational impact estimate.',
    aviation,
    modes: [
      buildMode('Flights', baseStatus, location, updatedAt),
      buildMode('Trains', baseStatus, location, updatedAt),
      buildMode('Highways', baseStatus, location, updatedAt),
      buildMode('Road blocks', baseStatus, location, updatedAt),
    ],
    advisories: [
      'Confirm airport, rail, and highway updates before sending final public instructions.',
      'Prioritize ambulance, rescue, and supply routes over general traffic routing.',
      'Add field-team road-block reports to DRKA knowledge/RAG for better local decisions.',
    ],
  };
}

export function buildMobilityContext(summary: DisasterMobilitySummary) {
  const modes = summary.modes
    .map((mode) => `${mode.label}: ${mode.status} - ${mode.impact}. ${mode.detail}`)
    .join('\n');

  return [
    `Location: ${summary.location}`,
    `Situation: ${summary.situation}`,
    `Data status: ${summary.status}`,
    `Connector note: ${summary.connectorNote}`,
    `Aviation: ${summary.aviation.status}. ${summary.aviation.summary}`,
    `Airport: ${summary.aviation.airportCode} (${summary.aviation.airportLabel})`,
    `Flight sample: ${summary.aviation.flights
      .map((flight) => `${flight.flightNumber} ${flight.airline} ${flight.status} to ${flight.arrivalAirport}`)
      .join('; ') || 'No flight sample returned'}`,
    `Modes:\n${modes}`,
    `Advisories: ${summary.advisories.join(' ')}`,
  ].join('\n');
}
