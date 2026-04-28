import { fetchJson, getQueryParam, handleOptions, sendJson } from './_utils.js';

const AVIATIONSTACK_BASE_URL = 'https://api.aviationstack.com/v1';

const AIRPORT_LOOKUP = [
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

function resolveAirport(location) {
  return AIRPORT_LOOKUP.find((item) => item.pattern.test(location)) || {
    code: 'DEL',
    label: 'Nearest configured airport corridor',
  };
}

function formatAviationTime(value) {
  if (!value) {
    return 'Time not available';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function aviation(req, res) {
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: { message: 'Use GET for aviation impact.' } });
    return;
  }

  const location = getQueryParam(req, 'location', 'Delhi, India');
  const airport = resolveAirport(location);
  const accessKey = process.env.AVIATIONSTACK_API_KEY?.trim();

  if (!accessKey) {
    sendJson(res, 200, {
      status: 'not-configured',
      airportCode: airport.code,
      airportLabel: airport.label,
      summary: 'AviationStack key is not configured in the secure server environment.',
      flights: [],
    });
    return;
  }

  try {
    const params = new URLSearchParams({
      access_key: accessKey,
      dep_iata: airport.code,
      limit: '5',
    });
    const payload = await fetchJson(`${AVIATIONSTACK_BASE_URL}/flights?${params.toString()}`, {}, 12000);

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

    sendJson(res, 200, {
      status: 'live',
      airportCode: airport.code,
      airportLabel: airport.label,
      summary: flights.length
        ? `Live AviationStack sample found ${flights.length} departure record(s) for ${airport.code}.`
        : `AviationStack is connected, but no departure records were returned for ${airport.code}.`,
      flights,
    });
  } catch (error) {
    sendJson(res, 200, {
      status: 'unavailable',
      airportCode: airport.code,
      airportLabel: airport.label,
      summary: error.message || 'AviationStack flight data is unavailable right now.',
      flights: [],
    });
  }
};
