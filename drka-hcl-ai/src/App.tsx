import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  CloudSun,
  Database,
  ExternalLink,
  FileText,
  Menu,
  MessageSquarePlus,
  Mic,
  MicOff,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import {
  ChatMessage,
  detectLanguage,
  getLanguageLabel,
  LANGUAGE_OPTIONS,
  sendChat,
  SPEAKERS,
  speakText,
  SupportedLanguageCode,
  transcribeSpeech,
} from './lib/sarvam';
import {
  buildWeatherContext,
  extractLocationFromPrompt,
  fetchWeatherSummary,
  formatWeatherResponse,
  hasAccuWeatherApiKey,
  type WeatherSummary,
} from './lib/weather';
import {
  buildForecastContext,
  buildForecastDemo,
  type ForecastDemo,
} from './lib/weatherForecast';
import {
  buildRagContext,
  createKnowledgeDocument,
  retrieveRelevantChunks,
  type KnowledgeDocument,
} from './lib/rag';
import {
  buildDisasterMobilitySummary,
  buildMobilityContext,
  isDisasterMobilityContent,
  type DisasterMobilitySummary,
} from './lib/disasterMobility';
import { shouldUseSecureApi } from './lib/secureProxy';

type ResponseAction = {
  href: string;
  label: string;
  description: string;
  meta: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  languageCode: string;
  weatherSummary?: WeatherSummary;
  forecastDemo?: ForecastDemo;
  mobilitySummary?: DisasterMobilitySummary;
  responseAction?: ResponseAction;
  retrievedSources?: string[];
};

type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: Message[];
};

type SpeechRecognitionConstructor = {
  new (): SpeechRecognitionInstance;
};

type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  0: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
};

type SpeechRecognitionEventLike = Event & {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const STORAGE_KEY = 'drka-hcl-assistant-sessions';
const KNOWLEDGE_STORAGE_KEY = 'drka-hcl-knowledge-base';
const STORAGE_VERSION_KEY = 'drka-hcl-storage-version';
const STORAGE_VERSION = '2026-04-26-clean-mobility-state';
const DISASTER_RESPONSE_URL = 'https://dheerendersirohi-afk.github.io/drka-disaster-response/?v=20260429-42';
const INTERNAL_DISASTER_RESPONSE_PATH = '/disaster-response';
const WEATHER_TIMEOUT_MS = 15000;

const STARTERS = [
  'Summarize the latest disaster dashboard state in a concise briefing.',
  'Draft a public alert in simple language for citizens.',
  'Give me a resource deployment plan for a flood emergency.',
  'Share a quick weather risk update for Mumbai.',
  'Show a 12-hour weather prediction demo for Delhi.',
  'புதுச்சேரிக்கு 5 நாள் வானிலை முன்னறிவிப்பு சொல்லுங்கள்.',
  'Translate an emergency advisory into Hindi.',
];

const WEATHER_KEYWORDS = [
  'weather',
  'forecast',
  'temperature',
  'rain',
  'storm',
  'wind',
  'cyclone',
  'tornado',
  'humidity',
  'monsoon',
  'mausam',
  'hawa',
  'climate',
  'मौसम',
  'हवामान',
  'હવામાન',
  'আবহাওয়া',
  'வானிலை',
  'முன்னறிவிப்பு',
  'மழை',
  'வெப்பநிலை',
  'காற்று',
  'आবोहवा',
  'મોસમ',
  'પવન',
  'ಮಳೆ',
  'ಹವಾಮಾನ',
  'వాతావరణం',
  'వర్షం',
  'കാലാവസ്ഥ',
  'മഴ',
  'ମେଘ',
  'ପାଗ',
  'ਬਰਸਾਤ',
  'ਮੌਸਮ',
  'موسم',
];

const OPERATIONAL_LOCATION_ALIASES = [
  { pattern: /\b(puducherry|puduchery|pondicherry|pondy)\b|புதுச்சேரி/u, location: 'Puducherry, India' },
  { pattern: /\b(chennai)\b|சென்னை/u, location: 'Chennai, India' },
  { pattern: /\b(mumbai)\b|मुंबई/u, location: 'Mumbai, India' },
  { pattern: /\b(delhi|new delhi)\b|दिल्ली/u, location: 'Delhi, India' },
  { pattern: /\b(kolkata)\b|কলকাতা/u, location: 'Kolkata, India' },
  { pattern: /\b(bengaluru|bangalore)\b|ಬೆಂಗಳೂರು/u, location: 'Bengaluru, India' },
  { pattern: /\b(hyderabad)\b|హైదరాబాదు|హైదరాబాద్/u, location: 'Hyderabad, India' },
  { pattern: /\b(ahmedabad)\b|અમદાવાદ/u, location: 'Ahmedabad, India' },
  { pattern: /\b(pune)\b|पुणे/u, location: 'Pune, India' },
  { pattern: /\b(hapur)\b|हापुड़/u, location: 'Hapur, Uttar Pradesh' },
];

const LOCATION_LANGUAGE_RULES: Array<{
  language: SupportedLanguageCode;
  pattern: RegExp;
}> = [
  { language: 'ta-IN', pattern: /\b(puducherry|puduchery|pondicherry|pondy|tamil nadu|chennai|madurai|coimbatore|trichy)\b|புதுச்சேரி|தமிழ்நாடு|சென்னை/u },
  { language: 'gu-IN', pattern: /\b(gujarat|ahmedabad|surat|vadodara|rajkot)\b|ગુજરાત|અમદાવાદ/u },
  { language: 'mr-IN', pattern: /\b(maharashtra|mumbai|pune|nagpur|nashik)\b|महाराष्ट्र|मुंबई|पुणे/u },
  { language: 'bn-IN', pattern: /\b(west bengal|kolkata|howrah|siliguri)\b|পশ্চিমবঙ্গ|কলকাতা/u },
  { language: 'as-IN', pattern: /\b(assam|guwahati|dispur|dibrugarh|jorhat|silchar)\b|অসম|গুৱাহাটী/u },
  { language: 'brx-IN', pattern: /\b(bodo|bodoland|kokrajhar)\b|बड़ो/u },
  { language: 'doi-IN', pattern: /\b(dogri|jammu|dogra)\b|डोगरी/u },
  { language: 'kn-IN', pattern: /\b(karnataka|bengaluru|bangalore|mysuru|hubli)\b|ಕರ್ನಾಟಕ|ಬೆಂಗಳೂರು/u },
  { language: 'ks-IN', pattern: /\b(kashmir|srinagar|anantnag|baramulla)\b|کشمیر|سرینگر/u },
  { language: 'kok-IN', pattern: /\b(konkani|konkan|mangalore|mangaluru)\b|कोंकणी/u },
  { language: 'mai-IN', pattern: /\b(maithili|mithila|darbhanga|madhubani)\b|मैथिली|मिथिला/u },
  { language: 'ml-IN', pattern: /\b(kerala|kochi|ernakulam|thiruvananthapuram|trivandrum|kozhikode)\b|കേരളം|കൊച്ചി/u },
  { language: 'mni-IN', pattern: /\b(manipur|imphal|manipuri|meitei|meetei)\b|ꯃꯅꯤꯄꯨꯔ/u },
  { language: 'ne-IN', pattern: /\b(nepali|sikkim|gangtok|darjeeling)\b|नेपाली|सिक्किम/u },
  { language: 'te-IN', pattern: /\b(andhra pradesh|telangana|hyderabad|visakhapatnam|vijayawada|tirupati)\b|తెలంగాణ|ఆంధ్ర/u },
  { language: 'pa-IN', pattern: /\b(punjab|amritsar|ludhiana|jalandhar|patiala)\b|ਪੰਜਾਬ|ਅੰਮ੍ਰਿਤਸਰ/u },
  { language: 'od-IN', pattern: /\b(odisha|orissa|bhubaneswar|पुरी|puri|cuttack)\b|ଓଡ଼ିଶା|ଭୁବନେଶ୍ୱର/u },
  { language: 'sa-IN', pattern: /\b(sanskrit|vedic)\b|संस्कृत/u },
  { language: 'sat-IN', pattern: /\b(santali|santhal|jharkhand)\b|ᱥᱟᱱᱛᱟᱲᱤ/u },
  { language: 'sd-IN', pattern: /\b(sindhi|sindh)\b|سنڌي/u },
  { language: 'ur-IN', pattern: /\b(urdu|lucknow|hyderabad old city)\b|اردو/u },
  { language: 'hi-IN', pattern: /\b(delhi|new delhi|uttar pradesh|lucknow|kanpur|varanasi|bihar|patna|madhya pradesh|bhopal|rajasthan|jaipur|jharkhand|ranchi|haryana)\b|दिल्ली|उत्तर प्रदेश|लखनऊ/u },
];

const RESPONSE_LANGUAGE_ALIASES: Array<{
  language: SupportedLanguageCode;
  names: string[];
  nativePattern?: RegExp;
}> = [
  { language: 'en-IN', names: ['english'] },
  { language: 'hi-IN', names: ['hindi'], nativePattern: /हिंदी|हिन्दी/i },
  { language: 'as-IN', names: ['assamese', 'asamiya'], nativePattern: /অসমীয়া|অসমিয়া/i },
  { language: 'bn-IN', names: ['bengali', 'bangla'], nativePattern: /বাংলা/i },
  { language: 'brx-IN', names: ['bodo', 'boro'], nativePattern: /बड़ो|बर'/i },
  { language: 'doi-IN', names: ['dogri'], nativePattern: /डोगरी/i },
  { language: 'gu-IN', names: ['gujarati'], nativePattern: /ગુજરાતી/i },
  { language: 'kn-IN', names: ['kannada'], nativePattern: /ಕನ್ನಡ/i },
  { language: 'ks-IN', names: ['kashmiri'], nativePattern: /کٲشُر|कश्मीरी/i },
  { language: 'kok-IN', names: ['konkani'], nativePattern: /कोंकणी/i },
  { language: 'mai-IN', names: ['maithili'], nativePattern: /मैथिली/i },
  { language: 'ml-IN', names: ['malayalam'], nativePattern: /മലയാളം/i },
  { language: 'mni-IN', names: ['manipuri', 'meitei', 'meetei'], nativePattern: /ꯃꯅꯤꯄꯨꯔ/i },
  { language: 'mr-IN', names: ['marathi'], nativePattern: /मराठी/i },
  { language: 'ne-IN', names: ['nepali'], nativePattern: /नेपाली/i },
  { language: 'od-IN', names: ['odia', 'oriya'], nativePattern: /ଓଡ଼ିଆ|ଓଡିଆ/i },
  { language: 'pa-IN', names: ['punjabi'], nativePattern: /ਪੰਜਾਬੀ/i },
  { language: 'sa-IN', names: ['sanskrit'], nativePattern: /संस्कृत/i },
  { language: 'sat-IN', names: ['santali'], nativePattern: /ᱥᱟᱱᱛᱟᱲᱤ/i },
  { language: 'sd-IN', names: ['sindhi'], nativePattern: /سنڌي|सिन्धी/i },
  { language: 'ta-IN', names: ['tamil'], nativePattern: /தமிழ்/i },
  { language: 'te-IN', names: ['telugu'], nativePattern: /తెలుగు/i },
  { language: 'ur-IN', names: ['urdu'], nativePattern: /اردو/i },
];

const RESPONSE_LANGUAGE_NAMES = RESPONSE_LANGUAGE_ALIASES.flatMap((item) => item.names).join('|');
const RESPONSE_LANGUAGE_DIRECTIVE_PATTERN =
  new RegExp(
    `\\b(?:in|into|to|using|write|reply|respond|answer|speak)\\s+(?:in\\s+)?(?:${RESPONSE_LANGUAGE_NAMES})\\b|` +
      `\\b(?:${RESPONSE_LANGUAGE_NAMES})\\s+(?:me|mein|main|language|reply|response|answer)\\b|` +
      'हिंदी|हिन्दी|অসমীয়া|অসমিয়া|বাংলা|बड़ो|डोगरी|ગુજરાતી|ಕನ್ನಡ|کٲشُر|कश्मीरी|कोंकणी|मैथिली|മലയാളം|ꯃꯅꯤꯄꯨꯔ|मराठी|नेपाली|ଓଡ଼ିଆ|ଓଡିଆ|ਪੰਜਾਬੀ|संस्कृत|ᱥᱟᱱᱛᱟᱲᱤ|سنڌي|सिन्धी|தமிழ்|తెలుగు|اردو',
    'gi'
  );

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

function createConversation(): Conversation {
  return {
    id: createId(),
    title: 'New conversation',
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function buildTitle(prompt: string) {
  const compact = prompt.replace(/\s+/g, ' ').trim();
  return compact.length > 36 ? `${compact.slice(0, 36)}...` : compact || 'New conversation';
}

function isWeatherContent(content: string) {
  const lowered = content.toLowerCase();
  return WEATHER_KEYWORDS.some((keyword) => lowered.includes(keyword.toLowerCase()));
}

function shouldFetchWeather(content: string) {
  const lowered = content.toLowerCase();
  const hasWeatherTerm = isWeatherContent(content);
  const asksDashboardOnly = /\b(disaster dashboard|dashboard state|resource deployment|public alert|sop|manual|briefing)\b/i.test(
    content
  );
  const hasTransportOrHazardContext =
    /\b(weather|forecast|temperature|rain|storm|wind|humidity|monsoon|cyclone|tornado|flood|heat|airport|flight|train|highway|road\s?block|traffic)\b/i.test(
      lowered
    );

  return hasWeatherTerm && (!asksDashboardOnly || hasTransportOrHazardContext);
}

function resolveRequestedResponseLanguage(content: string) {
  const normalized = content.toLowerCase();

  return RESPONSE_LANGUAGE_ALIASES.find((rule) => {
    if (rule.nativePattern?.test(content)) {
      return true;
    }

    return rule.names.some((name) => {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const requestPattern = new RegExp(
        `\\b(?:in|into|to|using|write|reply|respond|answer|speak)\\s+(?:in\\s+)?${escapedName}\\b|` +
          `\\b${escapedName}\\s+(?:me|mein|main|language|reply|response|answer)\\b`,
        'i'
      );
      return requestPattern.test(normalized);
    });
  })?.language;
}

function resolveAutoLanguage(content: string) {
  const requestedLanguage = resolveRequestedResponseLanguage(content);

  if (requestedLanguage) {
    return requestedLanguage;
  }

  for (const rule of LOCATION_LANGUAGE_RULES) {
    if (rule.pattern.test(content)) {
      return rule.language;
    }
  }

  return detectLanguage(content);
}

function resolveOperationalLocation(content: string, extractedLocation: string) {
  const trimmedExtracted = extractedLocation.trim();
  const contentForLocation = content.replace(RESPONSE_LANGUAGE_DIRECTIVE_PATTERN, '').replace(/\s+/g, ' ').trim();
  const normalizedContent = contentForLocation.trim().toLowerCase();
  const knownLocation = OPERATIONAL_LOCATION_ALIASES.find((item) => item.pattern.test(contentForLocation));

  if (knownLocation) {
    return knownLocation.location;
  }

  const locationMatch = contentForLocation.match(
    /\b(?:in|for|near|around|at)\s+([a-zA-Z\s]+?)(?:,|\s+(?:and|with|show|weather|forecast|flight|flights|aviation|train|trains|highway|highways|road|roads|roadblock|roadblocks|impact|warning|alert|disaster|situation|status|data)\b|$)/i
  );
  const parsed = locationMatch?.[1]?.replace(/\s+/g, ' ').trim();

  if (parsed && parsed.length <= 42) {
    return parsed;
  }

  if (trimmedExtracted && trimmedExtracted.length <= 42 && trimmedExtracted.toLowerCase() !== normalizedContent) {
    return trimmedExtracted;
  }

  return trimmedExtracted && trimmedExtracted.length <= 80 ? trimmedExtracted : '';
}

function resolveRecognitionLanguage(selectedLanguage: SupportedLanguageCode, draft: string) {
  if (selectedLanguage !== 'auto') {
    return selectedLanguage;
  }

  if (draft.trim()) {
    return resolveAutoLanguage(draft);
  }

  const browserLanguage = navigator.language.toLowerCase();
  const supported = LANGUAGE_OPTIONS.find(
    (option) => option.code !== 'auto' && option.code.toLowerCase() === browserLanguage
  );

  return supported?.code || 'hi-IN';
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function withAbortTimeout<T>(timeoutMs: number, task: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await task(controller.signal);
  } finally {
    window.clearTimeout(timeout);
  }
}

function getPreferredAudioMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  return [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || '';
}

function canUseSaarasProvider() {
  return shouldUseSecureApi() || Boolean(import.meta.env.VITE_SARVAM_API_KEY?.trim());
}

function getVoiceInputErrorMessage(caughtError: unknown) {
  if (caughtError instanceof DOMException) {
    if (caughtError.name === 'NotAllowedError' || caughtError.name === 'SecurityError') {
      return 'Microphone permission is blocked. Allow microphone access for this site, then try Saaras V3 voice input again.';
    }

    if (caughtError.name === 'NotFoundError' || caughtError.name === 'DevicesNotFoundError') {
      return 'No microphone was detected. Connect or enable a microphone, then try Saaras V3 again.';
    }

    if (caughtError.name === 'NotReadableError') {
      return 'The microphone is already in use by another app. Close the other recorder/call and try again.';
    }
  }

  return caughtError instanceof Error ? caughtError.message : 'Unable to start Saaras V3 voice input.';
}

function isSupportedKnowledgeFile(file: File) {
  return /\.(txt|md|markdown|json|csv)$/i.test(file.name) || file.type.startsWith('text/');
}

function getWeatherRisks(summary: WeatherSummary) {
  const risks: string[] = [];
  const condition = summary.condition.toLowerCase();

  if (summary.currentTempC >= 40 || /heat|hot|sunny/.test(condition)) {
    risks.push('Heat stress');
  }
  if (/rain|storm|thunder|shower/.test(condition)) {
    risks.push('Heavy rain risk');
  }
  if (/cyclone|tornado|squall/.test(condition)) {
    risks.push('Severe wind risk');
  }
  if (summary.wind && /\b([3-9]\d|[1-9]\d{2,})\s?(km\/h|kph|mph)\b/i.test(summary.wind)) {
    risks.push('Strong wind');
  }
  if (!risks.length) {
    risks.push('No major trigger');
  }

  return risks;
}

function getWeatherBars(summary: WeatherSummary) {
  const numbers = [
    summary.currentTempC,
    summary.realFeelC,
    summary.tonightLowC,
    summary.tomorrowHighC,
  ].filter((value) => Number.isFinite(value));
  const baseline = numbers.length ? Math.min(...numbers) : 0;
  const peak = numbers.length ? Math.max(...numbers) : 0;
  const spread = Math.max(peak - baseline, 1);

  return [
    { label: 'Current', value: summary.currentTempC },
    { label: 'RealFeel', value: summary.realFeelC },
    { label: 'Tonight', value: summary.tonightLowC },
    { label: 'Tomorrow', value: summary.tomorrowHighC },
  ].map((item) => ({
    ...item,
    fill: Math.max(12, ((item.value - baseline) / spread) * 100),
  }));
}

function getWeatherChartPoints(summary: WeatherSummary) {
  const sourcePoints = summary.dailyForecasts.length
    ? summary.dailyForecasts.map((day) => ({ label: day.label, value: day.maxC }))
    : [
        { label: 'Current', value: summary.currentTempC },
        { label: 'RealFeel', value: summary.realFeelC },
        { label: 'Tonight', value: summary.tonightLowC },
        { label: 'Tomorrow', value: summary.tomorrowHighC },
      ];
  const values = sourcePoints.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);
  const width = 520;
  const height = 150;
  const step = width / Math.max(sourcePoints.length - 1, 1);

  return sourcePoints.map((point, index) => ({
    ...point,
    x: index * step,
    y: 24 + ((max - point.value) / spread) * (height - 48),
  }));
}

function getWeatherChartPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

function getWeatherChartArea(points: Array<{ x: number; y: number }>) {
  if (!points.length) {
    return '';
  }

  const line = getWeatherChartPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x.toFixed(1)} 150 L ${first.x.toFixed(1)} 150 Z`;
}

function getFallbackNotice(error: unknown, languageCode: string = 'en-IN') {
  const message = error instanceof Error ? error.message : '';
  const useHindi = languageCode === 'hi-IN';
  const useTamil = languageCode === 'ta-IN';

  if (/rate limit|429/i.test(message)) {
    if (useHindi) {
      return 'Sarvam AI फिलहाल rate-limited है, इसलिए DRKA उपलब्ध डेटा से स्थानीय fallback जवाब दिखा रहा है।';
    }

    if (useTamil) {
      return 'Sarvam AI தற்போது rate-limited உள்ளது. DRKA கிடைக்கும் தரவின் அடிப்படையில் பதிலை காட்டுகிறது.';
    }

    return 'Sarvam AI is temporarily rate-limited, so DRKA is showing a local fallback response from the available data.';
  }

  if (/credit|quota|billing/i.test(message)) {
    if (useHindi) {
      return 'Sarvam AI जुड़ा हुआ है, लेकिन इस समय account में credits उपलब्ध नहीं हैं, इसलिए DRKA उपलब्ध डेटा से स्थानीय fallback जवाब दिखा रहा है।';
    }

    if (useTamil) {
      return 'Sarvam AI இணைக்கப்பட்டுள்ளது, ஆனால் இப்போது account credits இல்லை. DRKA கிடைக்கும் தரவின் அடிப்படையில் பதிலை காட்டுகிறது.';
    }

    return 'Sarvam AI is connected, but the account has no available credits right now, so DRKA is showing a local fallback response from the available data.';
  }

  if (/abort|timeout/i.test(message)) {
    if (useHindi) {
      return 'AI/provider request में ज्यादा समय लगा, इसलिए DRKA उपलब्ध डेटा से स्थानीय fallback जवाब दिखा रहा है।';
    }

    if (useTamil) {
      return 'AI/provider கோரிக்கை அதிக நேரம் எடுத்தது. DRKA கிடைக்கும் தரவின் அடிப்படையில் பதிலை காட்டுகிறது.';
    }

    return 'The AI/provider request took too long, so DRKA is showing a local fallback response from the available data.';
  }

  if (useHindi) {
    return 'AI जवाब उपलब्ध नहीं था, इसलिए DRKA उपलब्ध डेटा से स्थानीय fallback जवाब दिखा रहा है।';
  }

  if (useTamil) {
    return 'AI பதில் கிடைக்கவில்லை. DRKA கிடைக்கும் தரவின் அடிப்படையில் பதிலை காட்டுகிறது.';
  }

  return 'AI response was unavailable, so DRKA is showing a local fallback response from the available data.';
}

function buildLocalAssistantFallback(prompt: string, ragContext: string, retrievedSources: string[]) {
  const sourceLine = retrievedSources.length
    ? `\n\nRetrieved sources used: ${retrievedSources.join(', ')}.`
    : '';
  const knowledgeLine = ragContext
    ? `\n\nKnowledge base context is available for this answer. Use the retrieved SOP/manual details above for field decisions.`
    : '';

  return (
    `DRKA local showcase mode is active. Sarvam AI is unavailable or rate-limited right now, so I can still help with a structured response.\n\n` +
    `For: "${prompt}"\n\n` +
    `Suggested response:\n` +
    `1. Confirm the affected location, incident type, severity, and time window.\n` +
    `2. Check weather, mobility, and field reports before sending public instructions.\n` +
    `3. Prioritize rescue, medical, food/water, shelter, and safe-route coordination.\n` +
    `4. Use the RAG/SOP upload panel for official manuals and local incident playbooks.` +
    knowledgeLine +
    sourceLine
  );
}

function buildDisasterResponseAction(location?: string): ResponseAction {
  const cleanLocation = location?.trim();
  const url = new URL(getDisasterResponseBaseUrl(), window.location.origin);

  if (cleanLocation) {
    url.searchParams.set('location', cleanLocation);
  }

  url.searchParams.set('source', 'drka');

  return {
    href: url.toString(),
    label: 'Open WhatsApp Response UI',
    description: cleanLocation
      ? `Continue disaster response coordination for ${cleanLocation}.`
      : 'Continue disaster response coordination in the DRKA response console.',
    meta: url.hostname === 'localhost' ? 'Local response console' : 'Web response console',
  };
}

function getConfiguredDisasterResponseUrl() {
  return import.meta.env.VITE_DISASTER_RESPONSE_URL?.trim() || '';
}

function getDisasterResponseBaseUrl() {
  const configuredUrl = getConfiguredDisasterResponseUrl();

  if (configuredUrl) {
    return configuredUrl;
  }

  return DISASTER_RESPONSE_URL;
}

function isInternalDisasterResponsePage() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.pathname.replace(/\/$/, '') === INTERNAL_DISASTER_RESPONSE_PATH;
}

function DisasterResponseConsole() {
  const query = new URLSearchParams(window.location.search);
  const initialLocation = query.get('location') || 'Selected city/state';
  const source = query.get('source') || 'drka';
  const [location, setLocation] = useState(initialLocation);
  const [incidentType, setIncidentType] = useState('Severe weather');
  const [priority, setPriority] = useState('High');
  const [assignedTeam, setAssignedTeam] = useState('City control room');
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `DRKA disaster response coordination request for ${location}. Incident: ${incidentType}. Priority: ${priority}. Assigned: ${assignedTeam}. Source: ${source}.`
  )}`;

  useEffect(() => {
    document.body.classList.add('response-page-body');

    return () => {
      document.body.classList.remove('response-page-body');
    };
  }, []);

  return (
    <main className="response-console-shell">
      <section className="response-console-hero">
        <div>
          <span className="response-console-kicker">DRKA(HCL) Disaster Response</span>
          <h1>City/state response console</h1>
          <p>
            This web-safe page replaces the old localhost link on the public showcase. Use it to coordinate responders,
            share a WhatsApp handoff, and keep the city context from the chatbot.
          </p>
        </div>
        <a className="response-back-link" href="/">
          Back to DRKA chat
        </a>
      </section>

      <section className="response-console-grid">
        <div className="response-phone-card">
          <div className="response-phone-header">
            <strong>WhatsApp-style handoff</strong>
            <span>Online ready</span>
          </div>
          <div className="response-phone-thread">
            <div className="response-chat-bubble incoming">DRKA alert received from chatbot.</div>
            <div className="response-chat-bubble outgoing">
              Location: <strong>{location}</strong>
              <br />
              Incident: <strong>{incidentType}</strong>
              <br />
              Priority: <strong>{priority}</strong>
              <br />
              Need responder confirmation, safe routes, shelters, medical aid, and public advisory.
            </div>
            <div className="response-chat-bubble incoming">
              Assigned to: {assignedTeam}. Confirm field team, ambulance desk, and supply coordinator.
            </div>
          </div>
          <a className="response-whatsapp-button" href={whatsappShareUrl}>
            Open WhatsApp handoff
            <ExternalLink size={15} />
          </a>
        </div>

        <div className="response-ops-card">
          <label>
            Disaster city/state
            <input value={location} onChange={(event) => setLocation(event.target.value)} />
          </label>
          <div className="response-option-grid">
            <label>
              Incident type
              <select value={incidentType} onChange={(event) => setIncidentType(event.target.value)}>
                <option>Severe weather</option>
                <option>Flood / waterlogging</option>
                <option>Cyclone / strong wind</option>
                <option>Heat emergency</option>
                <option>Earthquake / structural damage</option>
                <option>Medical rescue</option>
              </select>
            </label>
            <label>
              Priority
              <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option>High</option>
                <option>Critical</option>
                <option>Watch</option>
                <option>Normal</option>
              </select>
            </label>
            <label>
              Assigned team
              <select value={assignedTeam} onChange={(event) => setAssignedTeam(event.target.value)}>
                <option>City control room</option>
                <option>State disaster desk</option>
                <option>Field rescue team</option>
                <option>Medical and ambulance desk</option>
                <option>Supply and shelter desk</option>
              </select>
            </label>
          </div>
          <div className="response-ops-list">
            <article>
              <span>1</span>
              <div>
                <strong>Responder lead</strong>
                <p>Confirm who is responsible for city/state response and escalation.</p>
              </div>
            </article>
            <article>
              <span>2</span>
              <div>
                <strong>Safe movement</strong>
                <p>Check flights, trains, highways, road blocks, and ambulance corridors.</p>
              </div>
            </article>
            <article>
              <span>3</span>
              <div>
                <strong>Public advisory</strong>
                <p>Send multilingual alert with weather risk, shelters, helplines, and next update time.</p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}

function ChatApp() {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (localStorage.getItem(STORAGE_VERSION_KEY) !== STORAGE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
      return [createConversation()];
    }

    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return [createConversation()];
    }

    try {
      const parsed = JSON.parse(stored) as Conversation[];
      return parsed.length ? parsed : [createConversation()];
    } catch {
      return [createConversation()];
    }
  });
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>(() => {
    const stored = localStorage.getItem(KNOWLEDGE_STORAGE_KEY);

    if (!stored) {
      return [];
    }

    try {
      return JSON.parse(stored) as KnowledgeDocument[];
    } catch {
      return [];
    }
  });
  const [activeId, setActiveId] = useState(() => conversations[0]?.id || createConversation().id);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 980);
  const [speaker, setSpeaker] = useState<string>(SPEAKERS[0].code);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguageCode>('auto');
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioMessageId, setAudioMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speechInputSupported, setSpeechInputSupported] = useState(false);
  const [saarasInputSupported, setSaarasInputSupported] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedAudioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chatSurfaceRef = useRef<HTMLElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasMountedMessagesRef = useRef(false);
  const handleSendRef = useRef<(prompt?: string) => Promise<void>>(async () => {});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draftRef = useRef('');
  const loadingRef = useRef(false);
  const voiceModeRef = useRef(false);
  const autoSendTranscriptRef = useRef('');

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) || conversations[0],
    [activeId, conversations]
  );
  const liveWeatherAccessEnabled = shouldUseSecureApi() || hasAccuWeatherApiKey();
  const disasterResponseUrl = buildDisasterResponseAction().href;

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    const canRecordForSaaras = Boolean(
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
        typeof MediaRecorder !== 'undefined' &&
        canUseSaarasProvider()
    );
    setSaarasInputSupported(canRecordForSaaras);
    setSpeechInputSupported((current) => current || canRecordForSaaras);
  }, []);

  useEffect(() => {
    function syncSidebarForViewport() {
      setSidebarOpen(window.innerWidth > 980);
    }

    syncSidebarForViewport();
    window.addEventListener('resize', syncSidebarForViewport);

    return () => window.removeEventListener('resize', syncSidebarForViewport);
  }, []);

  useEffect(() => {
    voiceModeRef.current = voiceModeEnabled;
  }, [voiceModeEnabled]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(knowledgeDocs));
  }, [knowledgeDocs]);

  useEffect(() => {
    if (!conversations.length) {
      const nextConversation = createConversation();
      setConversations([nextConversation]);
      setActiveId(nextConversation.id);
      return;
    }

    const activeStillExists = conversations.some((conversation) => conversation.id === activeId);
    if (!activeStillExists) {
      setActiveId(conversations[0].id);
    }
  }, [activeId, conversations]);

  useEffect(() => {
    hasMountedMessagesRef.current = false;
    chatSurfaceRef.current?.scrollTo({ top: 0 });
  }, [activeId]);

  useEffect(() => {
    if (!hasMountedMessagesRef.current) {
      hasMountedMessagesRef.current = true;
      chatSurfaceRef.current?.scrollTo({ top: 0 });
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeConversation?.messages.length, loading]);

  function updateConversationById(id: string, updater: (conversation: Conversation) => Conversation) {
    setConversations((current) =>
      current.map((conversation) => (conversation.id === id ? updater(conversation) : conversation))
    );
  }

  async function resumeVoiceListening() {
    if (!voiceModeRef.current || !recognitionRef.current || loadingRef.current) {
      return;
    }

    try {
      autoSendTranscriptRef.current = '';
      recognitionRef.current.start();
    } catch {
      setIsListening(false);
    }
  }

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) {
      return;
    }

    const recognition = new Recognition();
    recognition.lang = resolveRecognitionLanguage(selectedLanguage, draftRef.current);
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => {
      autoSendTranscriptRef.current = '';
      setIsListening(true);
    };
    recognition.onend = () => {
      setIsListening(false);

      const transcript = autoSendTranscriptRef.current.trim();
      if (transcript && !loadingRef.current) {
        autoSendTranscriptRef.current = '';
        void handleSendRef.current(transcript);
      }
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      const speechError = (event as Event & { error?: string }).error;
      if (speechError) {
        setError(`Browser voice input stopped: ${speechError}. You can use Saaras V3 mic input or type your prompt.`);
      }
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();

      if (transcript) {
        autoSendTranscriptRef.current = transcript;
        setDraft(transcript);
      }
    };

    setSpeechInputSupported(true);
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [selectedLanguage]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }

      if (speechUtteranceRef.current) {
        window.speechSynthesis.cancel();
      }

      stopSaarasRecording(false);
    };
  }, []);

  useEffect(() => {
    if (voiceModeEnabled && speechInputSupported && !isListening && !loading && !audioMessageId) {
      void resumeVoiceListening();
    }
  }, [audioMessageId, isListening, loading, speechInputSupported, voiceModeEnabled]);

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    if (speechUtteranceRef.current) {
      speechUtteranceRef.current = null;
      window.speechSynthesis.cancel();
    }

    setAudioMessageId(null);
  }

  function startNewConversation() {
    const nextConversation = createConversation();
    setConversations((current) => [nextConversation, ...current]);
    setActiveId(nextConversation.id);
    setDraft('');
    setError(null);
  }

  function deleteConversation(conversationId: string) {
    setConversations((current) => {
      const filtered = current.filter((conversation) => conversation.id !== conversationId);
      return filtered.length ? filtered : [createConversation()];
    });
    setDraft('');
    setError(null);
  }

  function clearAllHistory() {
    const freshConversation = createConversation();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
    setConversations([freshConversation]);
    setActiveId(freshConversation.id);
    setDraft('');
    setError(null);
    stopAudio();
  }

  function clearKnowledgeBase() {
    localStorage.removeItem(KNOWLEDGE_STORAGE_KEY);
    setKnowledgeDocs([]);
  }

  async function handleKnowledgeUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);

    if (!files.length) {
      return;
    }

    try {
      const nextDocs: KnowledgeDocument[] = [];

      for (const file of files) {
        if (!isSupportedKnowledgeFile(file)) {
          continue;
        }

        const text = (await file.text()).trim();
        if (!text) {
          continue;
        }

        nextDocs.push(createKnowledgeDocument(file.name, text));
      }

      if (!nextDocs.length) {
        setError('Upload text, markdown, CSV, or JSON files for the DRKA knowledge base.');
      } else {
        setKnowledgeDocs((current) => [...nextDocs, ...current]);
        setError(null);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Knowledge upload failed.');
    } finally {
      event.target.value = '';
    }
  }

  async function streamAssistantMessage(
    conversationId: string,
    content: string,
    languageCode: string,
    weatherSummary?: WeatherSummary,
    forecastDemo?: ForecastDemo,
    mobilitySummary?: DisasterMobilitySummary,
    responseAction?: ResponseAction,
    retrievedSources?: string[]
  ) {
    const messageId = createId();
    const createdAt = new Date().toISOString();

    updateConversationById(conversationId, (conversation) => ({
      ...conversation,
      updatedAt: createdAt,
      messages: [
        ...conversation.messages,
        {
          id: messageId,
          role: 'assistant',
          content: '',
          createdAt,
          languageCode,
          weatherSummary,
          forecastDemo,
          mobilitySummary,
          responseAction,
          retrievedSources,
        },
      ],
    }));

    const chunkSize = Math.max(12, Math.ceil(content.length / 28));
    for (let index = chunkSize; index < content.length; index += chunkSize) {
      await delay(18);
      updateConversationById(conversationId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === messageId ? { ...message, content: content.slice(0, index) } : message
        ),
      }));
    }

    updateConversationById(conversationId, (conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.id === messageId
          ? { ...message, content, weatherSummary, forecastDemo, mobilitySummary, responseAction, retrievedSources }
          : message
      ),
    }));

    return {
      id: messageId,
      role: 'assistant' as const,
      content,
      createdAt,
      languageCode,
      weatherSummary,
      forecastDemo,
      mobilitySummary,
      responseAction,
      retrievedSources,
    };
  }

  async function handleSend(prompt = draft) {
    const content = prompt.trim();
    const conversationId = activeId;

    if (!content || !activeConversation || loading) {
      return;
    }

    const languageCode = selectedLanguage === 'auto' ? resolveAutoLanguage(content) : selectedLanguage;
    const userMessage: Message = {
      id: createId(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      languageCode,
    };

    updateConversationById(conversationId, (conversation) => ({
      ...conversation,
      title: conversation.messages.length ? conversation.title : buildTitle(content),
      updatedAt: new Date().toISOString(),
      messages: [...conversation.messages, userMessage],
    }));

    setDraft('');
    setLoading(true);
    setError(null);

    try {
      const retrievedChunks = retrieveRelevantChunks(knowledgeDocs, content);
      const ragContext = buildRagContext(retrievedChunks);
      const retrievedSources = Array.from(new Set(retrievedChunks.map((chunk) => chunk.documentName)));
      const weatherRequested = shouldFetchWeather(content);
      const mobilityRequested = isDisasterMobilityContent(content);
      const requestedLocation =
        weatherRequested || mobilityRequested
          ? resolveOperationalLocation(content, extractLocationFromPrompt(content))
          : '';
      const weatherSummary = weatherRequested
        ? await withAbortTimeout(WEATHER_TIMEOUT_MS, (signal) =>
            fetchWeatherSummary({
              locationQuery: requestedLocation || undefined,
              signal,
            })
          )
        : null;
      const mobilitySummary = mobilityRequested
        ? await buildDisasterMobilitySummary({
            locationQuery: requestedLocation || content,
            weatherSummary: weatherSummary || undefined,
          })
        : undefined;

      if (weatherSummary) {
        const forecastDemo = buildForecastDemo(weatherSummary);
        let weatherReply = formatWeatherResponse(weatherSummary, languageCode);

        try {
          const weatherTranscript: ChatMessage[] = [
            {
              role: 'system',
              content:
                `You are a weather and emergency assistant. Reply only using the weather facts provided. ` +
                `Do not guess missing values. Keep the answer concise, practical, and in ${getLanguageLabel(languageCode)}. ` +
                'Do not mention website names, source platforms, URLs, or data providers in the answer. ' +
                'Include the 12-hour prediction demo and risk outlook when it is relevant to the user prompt. ' +
                'If mobility impact data is provided, include flights, trains, highways, and road-block impact in the same answer. ' +
                'If the data status says fallback snapshot estimate, clearly tell the user it is not exact live city weather. ' +
                'If retrieved SOP or manual context is provided, prefer it for operational guidance and cite the source names naturally.',
            },
            {
              role: 'user',
              content:
                `User prompt: ${content}\n\n` +
                `Weather data:\n${buildWeatherContext(weatherSummary)}\n\n` +
                `Prediction demo:\n${buildForecastContext(forecastDemo)}` +
                (mobilitySummary ? `\n\nMobility impact:\n${buildMobilityContext(mobilitySummary)}` : '') +
                (ragContext ? `\n\nRetrieved knowledge:\n${ragContext}` : ''),
            },
          ];

          const weatherResponse = await sendChat(weatherTranscript, languageCode, 'sarvam-30b');
          weatherReply = weatherResponse.text;
        } catch {
          weatherReply = formatWeatherResponse(weatherSummary, languageCode);
        }

        const streamedWeatherMessage = await streamAssistantMessage(
          conversationId,
          weatherReply,
          languageCode,
          weatherSummary,
          forecastDemo,
          mobilitySummary,
          buildDisasterResponseAction(weatherSummary.location),
          retrievedSources
        );

        if (voiceModeRef.current) {
          await handleSpeak(streamedWeatherMessage);
        }

        return;
      }

      if (mobilitySummary) {
        const mobilityTranscript: ChatMessage[] = [
          {
            role: 'system',
            content:
              `You are a disaster mobility assistant. Reply in ${getLanguageLabel(languageCode)}. ` +
              'Use only the provided mobility impact facts. Be clear that connector-ready data is not a confirmed live feed. ' +
              'Do not mention website names, source platforms, URLs, or data providers in the answer.',
          },
          {
            role: 'user',
            content:
              `User prompt: ${content}\n\n` +
              `Mobility impact:\n${buildMobilityContext(mobilitySummary)}` +
              (ragContext ? `\n\nRetrieved knowledge:\n${ragContext}` : ''),
          },
        ];
        let mobilityReply =
          `Movement impact for ${mobilitySummary.location}: ${mobilitySummary.situation}. ` +
          `${mobilitySummary.connectorNote} ` +
          mobilitySummary.modes
            .map((mode) => `${mode.label}: ${mode.impact}. ${mode.detail}`)
            .join(' ');

        try {
          const mobilityResponse = await sendChat(mobilityTranscript, languageCode);
          mobilityReply = mobilityResponse.text;
        } catch (caughtError) {
          mobilityReply = `${getFallbackNotice(caughtError, languageCode)}\n\n${mobilityReply}`;
        }

        const streamedMobilityMessage = await streamAssistantMessage(
          conversationId,
          mobilityReply,
          languageCode,
          undefined,
          undefined,
          mobilitySummary,
          buildDisasterResponseAction(mobilitySummary.location),
          retrievedSources
        );

        if (voiceModeRef.current) {
          await handleSpeak(streamedMobilityMessage);
        }

        return;
      }

      const transcript: ChatMessage[] = [
        {
          role: 'system',
          content:
            `You are a polished, helpful AI assistant. Answer clearly, stay concise, and respond in ${getLanguageLabel(languageCode)}. ` +
            `When retrieved document context is available, ground your answer in it and avoid inventing unsupported details.`,
        },
        ...(ragContext
          ? ([
              {
                role: 'system',
                content:
                  `Retrieved knowledge base context follows. Use it when relevant and prefer it over generic advice.\n\n${ragContext}`,
              },
            ] as ChatMessage[])
          : []),
        ...activeConversation.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })) as ChatMessage[],
        {
          role: 'user',
          content,
        },
      ];

      let responseText = '';
      let responseLanguageCode: SupportedLanguageCode = languageCode;

      try {
        const response = await sendChat(transcript, languageCode);
        responseText = response.text;
        responseLanguageCode = response.languageCode as SupportedLanguageCode;
      } catch (caughtError) {
        responseText = `${getFallbackNotice(caughtError, languageCode)}\n\n${buildLocalAssistantFallback(
          content,
          ragContext,
          retrievedSources
        )}`;
      }

      const streamedMessage = await streamAssistantMessage(
        conversationId,
        responseText,
        responseLanguageCode,
        undefined,
        undefined,
        undefined,
        undefined,
        retrievedSources
      );

      if (voiceModeRef.current) {
        await handleSpeak(streamedMessage);
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Something went wrong.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  function normalizeSpeechContent(content: string) {
    return content
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[*_#`>|[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function splitBrowserSpeechText(text: string, maxLength = 220) {
    const sentences = text.split(/(?<=[.!?।])\s+/u).filter(Boolean);
    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences.length ? sentences : [text]) {
      const next = current ? `${current} ${sentence}` : sentence;

      if (next.length <= maxLength) {
        current = next;
        continue;
      }

      if (current) {
        chunks.push(current);
      }

      if (sentence.length <= maxLength) {
        current = sentence;
        continue;
      }

      for (let index = 0; index < sentence.length; index += maxLength) {
        chunks.push(sentence.slice(index, index + maxLength).trim());
      }
      current = '';
    }

    if (current) {
      chunks.push(current);
    }

    return chunks.filter(Boolean);
  }

  function getBrowserVoice(languageCode: string) {
    const voices = window.speechSynthesis.getVoices();
    const baseLanguage = languageCode.split('-')[0];

    return (
      voices.find((voice) => voice.lang === languageCode) ||
      voices.find((voice) => voice.lang.toLowerCase().startsWith(`${baseLanguage.toLowerCase()}-`)) ||
      null
    );
  }

  function speakWithBrowserVoice(message: Message, languageCode: string) {
    return new Promise<void>((resolve, reject) => {
      if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
        reject(new Error('Browser voice playback is not supported on this device.'));
        return;
      }

      const speechText = normalizeSpeechContent(message.content);
      const chunks = splitBrowserSpeechText(speechText);
      let chunkIndex = 0;
      const finish = () => {
        speechUtteranceRef.current = null;
        setAudioMessageId(null);
        void resumeVoiceListening();
        resolve();
      };

      if (!chunks.length) {
        reject(new Error('There is no readable text to speak.'));
        return;
      }

      const speakNextChunk = () => {
        const chunk = chunks[chunkIndex];

        if (!chunk) {
          finish();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(chunk);
        const voice = getBrowserVoice(languageCode);
        utterance.lang = languageCode;
        utterance.rate = 0.95;
        utterance.pitch = 1;

        if (voice) {
          utterance.voice = voice;
        }

        utterance.onend = () => {
          chunkIndex += 1;
          speakNextChunk();
        };
        utterance.onerror = (event) => {
          speechUtteranceRef.current = null;
          setAudioMessageId(null);

          if (event.error === 'canceled' || event.error === 'interrupted') {
            resolve();
            return;
          }

          reject(new Error(`Browser voice playback failed: ${event.error || 'unknown error'}.`));
        };

        speechUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      };

      window.speechSynthesis.cancel();
      speakNextChunk();
    });
  }

  async function handleSpeak(message: Message) {
    try {
      stopAudio();
      setError(null);
      setAudioMessageId(message.id);
      const speechLanguageCode = message.languageCode === 'auto' ? detectLanguage(message.content) : message.languageCode;

      try {
        const url = await speakText(message.content, speechLanguageCode, speaker);
        audioUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          stopAudio();
          void resumeVoiceListening();
        };
        audio.onerror = () => {
          stopAudio();
          setAudioMessageId(message.id);
          void speakWithBrowserVoice(message, speechLanguageCode).catch((caughtError) => {
            stopAudio();
            setError(caughtError instanceof Error ? caughtError.message : 'Voice playback failed.');
          });
        };
        await audio.play();
      } catch {
        await speakWithBrowserVoice(message, speechLanguageCode);
      }
    } catch (caughtError) {
      stopAudio();
      setError(caughtError instanceof Error ? caughtError.message : 'Voice playback failed.');
    }
  }

  async function toggleSpeak(message: Message) {
    if (audioMessageId === message.id) {
      stopAudio();
      return;
    }

    await handleSpeak(message);
  }

  function stopSaarasRecording(shouldTranscribe = true) {
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      if (!shouldTranscribe) {
        recordedAudioChunksRef.current = [];
      }
      recorder.stop();
      return;
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    setIsListening(false);
  }

  async function handleSaarasRecordingComplete(mimeType: string) {
    const chunks = recordedAudioChunksRef.current;
    recordedAudioChunksRef.current = [];
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    setIsListening(false);

    if (!chunks.length) {
      return;
    }

    try {
      setError(null);
      setIsTranscribing(true);
      const audio = new Blob(chunks, { type: mimeType || 'audio/webm' });
      const asrLanguageCode = selectedLanguage === 'auto' ? 'unknown' : selectedLanguage;
      const result = await transcribeSpeech(audio, asrLanguageCode, 'transcribe');
      const transcript = result.transcript.trim();

      if (!transcript) {
        throw new Error('Saaras V3 did not detect speech.');
      }

      setDraft(transcript);
      if (!loadingRef.current) {
        await handleSendRef.current(transcript);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Saaras V3 transcription failed.');
    } finally {
      setIsTranscribing(false);
    }
  }

  async function startSaarasRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('Saaras V3 voice input needs microphone recording support in this browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const preferredMimeType = getPreferredAudioMimeType();
    const recorder = new MediaRecorder(stream, preferredMimeType ? { mimeType: preferredMimeType } : undefined);
    const recordingMimeType = recorder.mimeType || preferredMimeType || 'audio/webm';

    mediaStreamRef.current = stream;
    mediaRecorderRef.current = recorder;
    recordedAudioChunksRef.current = [];
    autoSendTranscriptRef.current = '';

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedAudioChunksRef.current.push(event.data);
      }
    };
    recorder.onerror = () => {
      setError('Saaras V3 recorder failed. Please try the mic again.');
      stopSaarasRecording(false);
    };
    recorder.onstop = () => {
      void handleSaarasRecordingComplete(recordingMimeType);
    };

    recorder.start();
    setIsListening(true);
    recordingTimeoutRef.current = window.setTimeout(() => stopSaarasRecording(true), 28000);
  }

  function toggleListening() {
    if (isListening) {
      if (mediaRecorderRef.current) {
        stopSaarasRecording(true);
      } else {
        recognitionRef.current?.stop();
      }
      return;
    }

    if (saarasInputSupported) {
      void startSaarasRecording().catch((caughtError) => {
        setIsListening(false);
        setError(getVoiceInputErrorMessage(caughtError));
      });
      return;
    }

    if (recognitionRef.current) {
      autoSendTranscriptRef.current = '';
      recognitionRef.current.start();
    }
  }

  function toggleVoiceMode() {
    setVoiceModeEnabled((current) => {
      const next = !current;

      if (!next) {
        recognitionRef.current?.stop();
        stopSaarasRecording(false);
        stopAudio();
      }

      return next;
    });
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-top">
          <button className="ghost-button strong" onClick={startNewConversation}>
            <MessageSquarePlus size={18} />
            {sidebarOpen && <span>New chat</span>}
          </button>
          <button className="icon-button" onClick={() => setSidebarOpen((current) => !current)}>
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>

        {sidebarOpen && (
          <>
            <div className="sidebar-section">
              <div className="sidebar-section-head">
                <span className="sidebar-label">Conversations</span>
                <button className="text-action" onClick={clearAllHistory}>
                  Clear all
                </button>
              </div>
              <div className="conversation-list">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`conversation-item ${conversation.id === activeId ? 'active' : ''}`}
                  >
                    <button className="conversation-main" onClick={() => setActiveId(conversation.id)}>
                      <span>{conversation.title}</span>
                      <small>{formatTime(conversation.updatedAt)}</small>
                    </button>
                    <button
                      className="conversation-delete"
                      onClick={() => deleteConversation(conversation.id)}
                      title="Delete chat"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="sidebar-section">
              <span className="sidebar-label">Sarvam Response Language</span>
              <select
                className="speaker-select"
                value={selectedLanguage}
                onChange={(event) => setSelectedLanguage(event.target.value as SupportedLanguageCode)}
              >
                {LANGUAGE_OPTIONS.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sidebar-section">
              <span className="sidebar-label">DRKA(HCL) Voice</span>
              <select
                className="speaker-select"
                value={speaker}
                onChange={(event) => setSpeaker(event.target.value)}
              >
                {SPEAKERS.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sidebar-section">
              <span className="sidebar-label">Weather Data</span>
              <div className={`status-card ${liveWeatherAccessEnabled ? 'live' : 'warning'}`}>
                <strong>{liveWeatherAccessEnabled ? 'Live city API enabled' : 'Exact city weather not enabled'}</strong>
                <span>
                  {liveWeatherAccessEnabled
                    ? 'DRKA can request live city weather through the secure server API.'
                    : 'Add ACCUWEATHER_API_KEY online or VITE_ACCUWEATHER_API_KEY on localhost to avoid fallback data.'}
                </span>
              </div>
            </div>

            <div className="sidebar-section">
              <span className="sidebar-label">Disaster Response</span>
              <a className="tool-link-card" href={disasterResponseUrl}>
                <span className="tool-link-icon">
                  <ExternalLink size={15} />
                </span>
                <strong>WhatsApp Response UI</strong>
                <small>Open live city/state response coordination.</small>
              </a>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-head">
                <span className="sidebar-label">Knowledge Base</span>
                {!!knowledgeDocs.length && (
                  <button className="text-action" onClick={clearKnowledgeBase}>
                    Clear docs
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                className="hidden-input"
                type="file"
                accept=".txt,.md,.markdown,.json,.csv,text/plain,text/markdown,application/json,text/csv"
                multiple
                onChange={handleKnowledgeUpload}
              />
              <button className="ghost-button" onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} />
                <span>Upload SOPs / manuals</span>
              </button>
              <div className="status-card knowledge">
                <strong>{knowledgeDocs.length ? `${knowledgeDocs.length} document(s) loaded` : 'No documents loaded yet'}</strong>
                <span>
                  Upload text, markdown, CSV, or JSON files. DRKA will retrieve the most relevant chunks and send them with your prompt.
                </span>
              </div>
              {!!knowledgeDocs.length && (
                <div className="knowledge-list">
                  {knowledgeDocs.slice(0, 6).map((document) => (
                    <div key={document.id} className="knowledge-item">
                      <FileText size={14} />
                      <div>
                        <strong>{document.name}</strong>
                        <small>{document.chunkCount} chunks</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-only" onClick={() => setSidebarOpen((current) => !current)}>
              <Menu size={18} />
            </button>
            <div>
              <p className="eyebrow">New project</p>
              <h1>DRKA(HCL) Assistant</h1>
            </div>
          </div>
          <div className="topbar-badges">
            <span className="badge"><Sparkles size={14} /> DRKA(HCL)</span>
            <span className="badge"><Bot size={14} /> DRKA(HCL) Assistant</span>
            <span className="badge">{getLanguageLabel(selectedLanguage)}</span>
            <button className={`mode-toggle ${voiceModeEnabled ? 'active' : ''}`} onClick={toggleVoiceMode}>
              {voiceModeEnabled ? <Mic size={14} /> : <MicOff size={14} />}
              <span>{voiceModeEnabled ? 'Voice mode on' : 'Voice mode off'}</span>
            </button>
          </div>
        </header>

        <section className="chat-surface" ref={chatSurfaceRef}>
          {activeConversation?.messages.length ? (
            <div className="messages">
              {activeConversation.messages.map((message) => (
                <article key={message.id} className={`message ${message.role}`}>
                  <div className="avatar">{message.role === 'assistant' ? 'AI' : 'You'}</div>
                  <div className="bubble-wrap">
                    <div className="bubble-meta">
                      <strong>{message.role === 'assistant' ? 'DRKA(HCL) Assistant' : 'You'}</strong>
                      <span>{formatTime(message.createdAt)}</span>
                    </div>
                    {message.role === 'assistant' && (
                      <div className="response-tags">
                        <span className="response-tag">{getLanguageLabel(message.languageCode)}</span>
                        {message.weatherSummary && (
                          <span className="response-tag weather">
                            <CloudSun size={14} />
                            <span>Weather</span>
                          </span>
                        )}
                        {message.weatherSummary?.source === 'snapshot' && (
                          <span className="response-tag estimate">Estimated</span>
                        )}
                        {message.retrievedSources?.length ? (
                          <span className="response-tag rag">
                            <Database size={14} />
                            <span>RAG</span>
                          </span>
                        ) : null}
                        {message.forecastDemo && <span className="response-tag forecast">Prediction demo</span>}
                        {message.mobilitySummary && <span className="response-tag mobility">Mobility impact</span>}
                        {message.responseAction && <span className="response-tag response-link">Response link</span>}
                      </div>
                    )}
                    <div className="bubble">
                      <p>{message.content}</p>
                      {message.weatherSummary && (
                        <div className="weather-board">
                          <div className="weather-visual-panel">
                            <div className="weather-hero">
                              <div>
                                <span className="weather-detail-label">{message.weatherSummary.location}</span>
                                <div className="weather-current-row">
                                  <span className="weather-sun" />
                                  <strong>{message.weatherSummary.currentTempC}°C</strong>
                                </div>
                                <p>{message.weatherSummary.condition}</p>
                              </div>
                              <div className="weather-hero-range">
                                <span>H {message.weatherSummary.tomorrowHighC}°</span>
                                <span>L {message.weatherSummary.tonightLowC}°</span>
                              </div>
                            </div>

                            {message.weatherSummary.dailyForecasts.length ? (
                              <div className="weather-day-strip">
                                {message.weatherSummary.dailyForecasts.map((day) => (
                                  <div key={day.label} className="weather-day-pill">
                                    <strong>{day.label}</strong>
                                    <span className="weather-mini-sun" />
                                    <small>{day.maxC}° {day.minC}°</small>
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            <div className="weather-chart">
                              {(() => {
                                const chartPoints = getWeatherChartPoints(message.weatherSummary);
                                return (
                                  <svg viewBox="0 0 520 150" role="img" aria-label="Temperature trend">
                                    <path className="weather-chart-area" d={getWeatherChartArea(chartPoints)} />
                                    <path className="weather-chart-line" d={getWeatherChartPath(chartPoints)} />
                                    {chartPoints.map((point) => (
                                      <g key={`${point.label}-${point.value}`}>
                                        <circle cx={point.x} cy={point.y} r="4" />
                                        <text x={point.x} y={Math.max(point.y - 12, 14)}>
                                          {point.value}°
                                        </text>
                                      </g>
                                    ))}
                                  </svg>
                                );
                              })()}
                            </div>

                            <div className="weather-metric-grid">
                              <div className="weather-metric-tile">
                                <span>Visibility</span>
                                <strong>{message.weatherSummary.visibility}</strong>
                                <small>{message.weatherSummary.visibility === 'Not available' ? 'Unavailable' : 'Observed'}</small>
                              </div>
                              <div className="weather-metric-tile">
                                <span>Wind</span>
                                <strong>{message.weatherSummary.wind}</strong>
                                <small>Current speed</small>
                              </div>
                              <div className="weather-metric-tile">
                                <span>Pressure</span>
                                <strong>{message.weatherSummary.pressure}</strong>
                                <small>Station reading</small>
                              </div>
                              <div className="weather-metric-tile">
                                <span>Humidity</span>
                                <strong>{message.weatherSummary.humidity}</strong>
                                <small>Relative humidity</small>
                              </div>
                              <div className="weather-metric-tile">
                                <span>AQI</span>
                                <strong>{message.weatherSummary.airQuality}</strong>
                                <small>Air quality</small>
                              </div>
                              <div className="weather-metric-tile">
                                <span>UV</span>
                                <strong>{message.weatherSummary.uvIndex}</strong>
                                <small>Sun exposure</small>
                              </div>
                              <div className="weather-metric-tile">
                                <span>NOAA</span>
                                <strong>{message.weatherSummary.noaa.status === 'available' ? 'Available' : 'Unavailable'}</strong>
                                <small>{message.weatherSummary.noaa.dataset || 'Climate context'}</small>
                              </div>
                            </div>
                          </div>

                          <div className="weather-board-grid">
                            <div className="weather-stat">
                              <span>Location</span>
                              <strong>{message.weatherSummary.location}</strong>
                            </div>
                            <div className="weather-stat">
                              <span>Condition</span>
                              <strong>{message.weatherSummary.condition}</strong>
                            </div>
                            <div className="weather-stat">
                              <span>Current</span>
                              <strong>{message.weatherSummary.currentTempC}°C</strong>
                            </div>
                            <div className="weather-stat">
                              <span>RealFeel</span>
                              <strong>{message.weatherSummary.realFeelC}°C</strong>
                            </div>
                            <div className="weather-stat">
                              <span>Tonight</span>
                              <strong>{message.weatherSummary.tonightLowC}°C</strong>
                            </div>
                            <div className="weather-stat">
                              <span>Tomorrow</span>
                              <strong>{message.weatherSummary.tomorrowHighC}°C</strong>
                            </div>
                          </div>

                          <div className="weather-board-detail">
                            <div>
                              <span className="weather-detail-label">Wind</span>
                              <p>{message.weatherSummary.wind}</p>
                            </div>
                            <div>
                              <span className="weather-detail-label">Air quality</span>
                              <p>{message.weatherSummary.airQuality}</p>
                            </div>
                            <div>
                              <span className="weather-detail-label">Observed</span>
                              <p>{message.weatherSummary.observedAt}</p>
                            </div>
                            <div>
                              <span className="weather-detail-label">Outlook</span>
                              <p>{message.weatherSummary.tomorrowSummary}</p>
                            </div>
                            <div>
                              <span className="weather-detail-label">Humidity</span>
                              <p>{message.weatherSummary.humidity}</p>
                            </div>
                            <div>
                              <span className="weather-detail-label">UV index</span>
                              <p>{message.weatherSummary.uvIndex}</p>
                            </div>
                            <div>
                              <span className="weather-detail-label">Cloud cover</span>
                              <p>{message.weatherSummary.cloudCover}</p>
                            </div>
                            <div>
                              <span className="weather-detail-label">Visibility</span>
                              <p>{message.weatherSummary.visibility}</p>
                            </div>
                            <div>
                              <span className="weather-detail-label">Pressure</span>
                              <p>{message.weatherSummary.pressure}</p>
                            </div>
                            <div>
                              <span className="weather-detail-label">Precipitation (1h)</span>
                              <p>{message.weatherSummary.precipitationLastHour}</p>
                            </div>
                            <div>
                              <span className="weather-detail-label">Data status</span>
                              <p>
                                {message.weatherSummary.source === 'live'
                                  ? message.weatherSummary.accuweatherSource === 'api'
                                    ? 'Live API weather'
                                    : 'Live parsed weather'
                                  : 'Fallback estimate'}
                              </p>
                            </div>
                            <div>
                              <span className="weather-detail-label">NOAA context</span>
                              <p>{message.weatherSummary.noaa.summary}</p>
                            </div>
                          </div>

                          <div className="weather-risk-list">
                            {getWeatherRisks(message.weatherSummary).map((risk) => (
                              <span key={risk} className="weather-risk-chip">
                                {risk}
                              </span>
                            ))}
                          </div>

                          <div className="weather-bars">
                            {getWeatherBars(message.weatherSummary).map((item) => (
                              <div key={item.label} className="weather-bar-row">
                                <span>{item.label}</span>
                                <div className="weather-bar-track">
                                  <div className="weather-bar-fill" style={{ width: `${item.fill}%` }} />
                                </div>
                                <strong>{item.value}°C</strong>
                              </div>
                            ))}
                          </div>

                          {message.weatherSummary.dailyForecasts.length ? (
                            <div className="daily-forecast-board">
                              <span className="weather-detail-label">5-day forecast</span>
                              <div className="daily-forecast-grid">
                                {message.weatherSummary.dailyForecasts.map((day) => (
                                  <div key={day.label} className="daily-forecast-card">
                                    <strong>{day.label}</strong>
                                    <span>{day.minC}°C - {day.maxC}°C</span>
                                    <small>{day.summary}</small>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                      {message.forecastDemo && (
                        <div className="forecast-board">
                          <div className="forecast-head">
                            <div>
                              <span className="forecast-label">12-hour prediction</span>
                              <strong>{message.forecastDemo.headline}</strong>
                            </div>
                            <div className="forecast-meta">
                              <span>{message.forecastDemo.trend}</span>
                              <span>{message.forecastDemo.confidence}</span>
                              <span>{message.forecastDemo.next12HourAverageC}°C avg</span>
                            </div>
                          </div>
                          <p className="forecast-summary">{message.forecastDemo.summary}</p>
                          <div className="forecast-risk-grid">
                            {message.forecastDemo.risks.map((risk) => (
                              <div key={risk.label} className={`forecast-risk-card ${risk.level.toLowerCase()}`}>
                                <span>{risk.label}</span>
                                <strong>{risk.level}</strong>
                                <small>{risk.score}/100</small>
                              </div>
                            ))}
                          </div>
                          <div className="forecast-timeline">
                            {message.forecastDemo.points.map((point) => (
                              <div key={point.hourLabel} className="forecast-point">
                                <strong>{point.hourLabel}</strong>
                                <span>{point.tempC}°C</span>
                                <small>Rain {point.precipitationChance}%</small>
                                <small>Wind {point.windRisk}%</small>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {message.mobilitySummary && (
                        <div className="mobility-board">
                          <div className="mobility-head">
                            <div>
                              <span className="forecast-label">Disaster mobility impact</span>
                              <strong>{message.mobilitySummary.location}</strong>
                            </div>
                            <div className="forecast-meta">
                              <span>{message.mobilitySummary.status === 'live' ? 'Live connector' : 'Connector-ready'}</span>
                              <span>{message.mobilitySummary.situation}</span>
                            </div>
                          </div>

                          <p className="forecast-summary">{message.mobilitySummary.connectorNote}</p>

                          <div className="aviation-panel">
                            <div>
                              <span className="weather-detail-label">AviationStack flights</span>
                              <strong>
                                {message.mobilitySummary.aviation.airportCode} · {message.mobilitySummary.aviation.airportLabel}
                              </strong>
                              <p>{message.mobilitySummary.aviation.summary}</p>
                            </div>
                            <span className={`aviation-status ${message.mobilitySummary.aviation.status}`}>
                              {message.mobilitySummary.aviation.status === 'live' ? 'Live' : 'Unavailable'}
                            </span>
                          </div>

                          {message.mobilitySummary.aviation.flights.length ? (
                            <div className="aviation-flight-list">
                              {message.mobilitySummary.aviation.flights.map((flight) => (
                                <div key={`${flight.flightNumber}-${flight.scheduledDeparture}`} className="aviation-flight-card">
                                  <strong>{flight.flightNumber}</strong>
                                  <span>{flight.airline}</span>
                                  <small>{flight.status} · {flight.scheduledDeparture}</small>
                                  <p>{flight.departureAirport} to {flight.arrivalAirport}</p>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <div className="mobility-mode-grid">
                            {message.mobilitySummary.modes.map((mode) => (
                              <div key={mode.label} className={`mobility-mode-card ${mode.status}`}>
                                <span>{mode.label}</span>
                                <strong>{mode.impact}</strong>
                                <p>{mode.detail}</p>
                                <small>Updated {mode.updatedAt}</small>
                              </div>
                            ))}
                          </div>

                          <div className="mobility-advisory-list">
                            {message.mobilitySummary.advisories.map((advisory) => (
                              <span key={advisory}>{advisory}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {message.responseAction && (
                        <div className="response-action-card">
                          <div>
                            <span className="weather-detail-label">{message.responseAction.meta}</span>
                            <strong>{message.responseAction.label}</strong>
                            <p>{message.responseAction.description}</p>
                          </div>
                          <a href={message.responseAction.href} className="response-action-button">
                            <span>Open</span>
                            <ExternalLink size={15} />
                          </a>
                        </div>
                      )}
                      {message.retrievedSources?.length ? (
                        <div className="source-board">
                          <span className="weather-detail-label">Retrieved sources</span>
                          <div className="source-chip-list">
                            {message.retrievedSources.map((source) => (
                              <span key={source} className="source-chip">
                                {source}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {message.role === 'assistant' && (
                      <button className="speak-button" onClick={() => void toggleSpeak(message)}>
                        {audioMessageId === message.id ? <Square size={14} /> : <Volume2 size={14} />}
                        <span>{audioMessageId === message.id ? 'Playing' : 'Speak'}</span>
                      </button>
                    )}
                  </div>
                </article>
              ))}

              {loading && (
                <article className="message assistant">
                  <div className="avatar">AI</div>
                  <div className="bubble-wrap">
                    <div className="bubble">
                      <p>Thinking through the response...</p>
                    </div>
                  </div>
                </article>
              )}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-badge">
                <Sparkles size={18} />
                <span>DRKA(HCL)</span>
              </div>
              <h2>What should we work on?</h2>
              <p>
                This is a separate project folder powered by DRKA(HCL) Assistant. Your original disaster dashboard stays untouched.
              </p>
              <div className="starter-grid">
                {STARTERS.map((prompt) => (
                  <button key={prompt} className="starter-card" onClick={() => void handleSend(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <footer className="composer-wrap">
          {error && <div className="error-banner">{error}</div>}
          <div className="composer">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              rows={1}
              placeholder="Message DRKA(HCL) Assistant..."
            />
            <div className="composer-actions">
              {speechInputSupported && (
                <button
                  className="icon-button"
                  onClick={toggleListening}
                  title={saarasInputSupported ? 'Saaras V3 voice input' : 'Browser voice input'}
                  disabled={isTranscribing}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
              <button className="send-button" onClick={() => void handleSend()} disabled={loading || !draft.trim()}>
                <Send size={18} />
              </button>
            </div>
          </div>
          <p className="composer-hint">
            {isTranscribing
              ? 'Saaras V3 is transcribing your voice...'
              : saarasInputSupported
                ? 'Mic uses Sarvam Saaras V3 speech-to-text. Click once to record, click again to transcribe and send.'
                : 'Enter sends. Shift+Enter adds a new line. Mic input auto-sends when speech ends.'}
          </p>
        </footer>
      </main>
    </div>
  );
}

export default function App() {
  return isInternalDisasterResponsePage() ? <DisasterResponseConsole /> : <ChatApp />;
}


