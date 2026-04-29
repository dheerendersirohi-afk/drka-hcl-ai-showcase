import { fetchSecureJson, shouldUseSecureApi } from './secureProxy';

const SARVAM_CHAT_URL = 'https://api.sarvam.ai/v1/chat/completions';
const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';
const SARVAM_ASR_URL = 'https://api.sarvam.ai/speech-to-text';
const SARVAM_TRANSLATE_URL = 'https://api.sarvam.ai/translate';
const SARVAM_MODEL = 'sarvam-105b';
const SARVAM_MAX_TOKENS = 2400;
const SARVAM_REASONING_EFFORT = null;
const REQUEST_TIMEOUT_MS = 45000;

const SARVAM_CHAT_MODELS = [
  {
    code: 'sarvam-30b',
    label: 'Sarvam 30B',
    description: 'Fast multilingual LLM for live DRKA chat and weather briefings.',
    status: 'Active',
  },
  {
    code: 'sarvam-105b',
    label: 'Sarvam 105B',
    description: 'Highest-quality LLM for deeper reasoning and operational planning.',
    status: 'Active',
  },
  {
    code: 'sarvam-m',
    label: 'Sarvam-M',
    description: 'Legacy reasoning LLM kept available for compatibility testing.',
    status: 'Legacy',
  },
] as const;

const SARVAM_MODEL_COVERAGE = [
  ...SARVAM_CHAT_MODELS,
  {
    code: 'sarvam-translate:v1',
    label: 'Sarvam Translate',
    description: 'Formal text translation across all 22 scheduled Indian languages plus English.',
    status: 'Active',
  },
  {
    code: 'mayura:v1',
    label: 'Mayura',
    description: 'High-quality translation and script correction for core Indian languages.',
    status: 'Active',
  },
  {
    code: 'bulbul:v3',
    label: 'Bulbul V3',
    description: 'Real Sarvam TTS voice playback for supported Indian languages.',
    status: 'Active',
  },
  {
    code: 'saaras:v3',
    label: 'Saaras V3',
    description: 'Speech-to-text for microphone input with transcribe/translate modes.',
    status: 'Active',
  },
  {
    code: 'sarvam-vision',
    label: 'Sarvam Vision',
    description: 'Document intelligence model available through the secure knowledge workflow.',
    status: 'Ready',
  },
] as const;

const SUPPORTED_LANGUAGES = [
  { code: 'auto', label: 'Auto detect' },
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'as-IN', label: 'Assamese' },
  { code: 'bn-IN', label: 'Bengali' },
  { code: 'brx-IN', label: 'Bodo' },
  { code: 'doi-IN', label: 'Dogri' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'ks-IN', label: 'Kashmiri' },
  { code: 'kok-IN', label: 'Konkani' },
  { code: 'mai-IN', label: 'Maithili' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'mni-IN', label: 'Manipuri' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'ne-IN', label: 'Nepali' },
  { code: 'od-IN', label: 'Odia' },
  { code: 'pa-IN', label: 'Punjabi' },
  { code: 'sa-IN', label: 'Sanskrit' },
  { code: 'sat-IN', label: 'Santali' },
  { code: 'sd-IN', label: 'Sindhi' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'ur-IN', label: 'Urdu' },
] as const;

const BULBUL_TTS_LANGUAGE_CODES = new Set([
  'en-IN',
  'hi-IN',
  'bn-IN',
  'ta-IN',
  'te-IN',
  'kn-IN',
  'ml-IN',
  'mr-IN',
  'gu-IN',
  'pa-IN',
  'od-IN',
]);

const SARVAM_SPEAKERS = [
  { code: 'shubh', label: 'Shubh' },
  { code: 'anushka', label: 'Anushka' },
  { code: 'abhilash', label: 'Abhilash' },
  { code: 'manisha', label: 'Manisha' },
  { code: 'vidya', label: 'Vidya' },
  { code: 'arya', label: 'Arya' },
  { code: 'karun', label: 'Karun' },
  { code: 'hitesh', label: 'Hitesh' },
  { code: 'aditya', label: 'Aditya' },
  { code: 'ritu', label: 'Ritu' },
  { code: 'priya', label: 'Priya' },
  { code: 'neha', label: 'Neha' },
  { code: 'rahul', label: 'Rahul' },
  { code: 'pooja', label: 'Pooja' },
  { code: 'rohan', label: 'Rohan' },
  { code: 'simran', label: 'Simran' },
  { code: 'kavya', label: 'Kavya' },
  { code: 'amit', label: 'Amit' },
  { code: 'dev', label: 'Dev' },
  { code: 'ishita', label: 'Ishita' },
  { code: 'shreya', label: 'Shreya' },
  { code: 'ratan', label: 'Ratan' },
  { code: 'varun', label: 'Varun' },
  { code: 'manan', label: 'Manan' },
  { code: 'sumit', label: 'Sumit' },
  { code: 'roopa', label: 'Roopa' },
  { code: 'kabir', label: 'Kabir' },
  { code: 'aayan', label: 'Aayan' },
  { code: 'ashutosh', label: 'Ashutosh' },
  { code: 'advait', label: 'Advait' },
  { code: 'anand', label: 'Anand' },
  { code: 'tanya', label: 'Tanya' },
  { code: 'tarun', label: 'Tarun' },
  { code: 'sunny', label: 'Sunny' },
  { code: 'mani', label: 'Mani' },
  { code: 'gokul', label: 'Gokul' },
  { code: 'vijay', label: 'Vijay' },
  { code: 'shruti', label: 'Shruti' },
  { code: 'suhani', label: 'Suhani' },
  { code: 'mohit', label: 'Mohit' },
  { code: 'kavitha', label: 'Kavitha' },
  { code: 'rehan', label: 'Rehan' },
  { code: 'soham', label: 'Soham' },
  { code: 'rupali', label: 'Rupali' },
] as const;

const MARATHI_HINTS = /\b(आहे|आणि|माझे|माझी|काय|तुम्ही|साठी|मध्ये|नाही)\b/u;

export const SPEAKERS = SARVAM_SPEAKERS;
export const LANGUAGE_OPTIONS = SUPPORTED_LANGUAGES;
export const CHAT_MODEL_OPTIONS = SARVAM_CHAT_MODELS;
export const MODEL_COVERAGE = SARVAM_MODEL_COVERAGE;
export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];
export type SarvamChatModelCode = (typeof SARVAM_CHAT_MODELS)[number]['code'];

const MAYURA_LANGUAGE_CODES = new Set([
  'bn-IN',
  'en-IN',
  'gu-IN',
  'hi-IN',
  'kn-IN',
  'ml-IN',
  'mr-IN',
  'od-IN',
  'pa-IN',
  'ta-IN',
  'te-IN',
]);

const LANGUAGE_SCRIPT_TESTS: Partial<Record<SupportedLanguageCode, RegExp>> = {
  'as-IN': /[\u0980-\u09FF]/,
  'bn-IN': /[\u0980-\u09FF]/,
  'brx-IN': /[\u0900-\u097F]/,
  'doi-IN': /[\u0900-\u097F]/,
  'gu-IN': /[\u0A80-\u0AFF]/,
  'hi-IN': /[\u0900-\u097F]/,
  'kn-IN': /[\u0C80-\u0CFF]/,
  'kok-IN': /[\u0900-\u097F]/,
  'ks-IN': /[\u0600-\u06FF]/,
  'mai-IN': /[\u0900-\u097F]/,
  'ml-IN': /[\u0D00-\u0D7F]/,
  'mni-IN': /[\uABC0-\uABFF\u0980-\u09FF]/,
  'mr-IN': /[\u0900-\u097F]/,
  'ne-IN': /[\u0900-\u097F]/,
  'od-IN': /[\u0B00-\u0B7F]/,
  'pa-IN': /[\u0A00-\u0A7F]/,
  'sa-IN': /[\u0900-\u097F]/,
  'sat-IN': /[\u1C50-\u1C7F]/,
  'sd-IN': /[\u0600-\u06FF]/,
  'ta-IN': /[\u0B80-\u0BFF]/,
  'te-IN': /[\u0C00-\u0C7F]/,
  'ur-IN': /[\u0600-\u06FF]/,
};

const MARATHI_WORD_HINTS = /\b(आहे|आणि|माझे|माझी|काय|तुम्ही|साठी|मध्ये|नाही)\b/u;
const TRANSLATION_CHUNK_CHARS = 900;

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type SarvamResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
      reasoning_content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type SarvamAudioResponse = {
  audios?: string[];
  audio?: string;
  error?: {
    message?: string;
    code?: string;
    request_id?: string;
  };
};

type SarvamAsrResponse = {
  transcript?: string;
  language_code?: string | null;
  language_probability?: number | null;
  error?: {
    message?: string;
    code?: string;
    request_id?: string;
  };
};

type SarvamTranslateResponse = {
  translated_text?: string;
  source_language_code?: string;
  error?: {
    message?: string;
    code?: string;
    request_id?: string;
  };
};

const MAX_TTS_CHARS = 2400;

function getLocalApiKey() {
  return import.meta.env.VITE_SARVAM_API_KEY?.trim() || '';
}

function canUseLocalProviderKey() {
  if (typeof window === 'undefined') {
    return false;
  }

  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname) && Boolean(getLocalApiKey());
}

function getApiKey() {
  const apiKey = getLocalApiKey();

  if (!apiKey) {
    throw new Error('Missing VITE_SARVAM_API_KEY. The new chat app reads it from the parent .env file.');
  }

  return apiKey;
}

function extractText(data: SarvamResponse) {
  const message = data.choices?.[0]?.message;

  if (!message) {
    return '';
  }

  if (typeof message.content === 'string') {
    return sanitizeModelText(message.content);
  }

  if (Array.isArray(message.content)) {
    const text = message.content
      .map((part) => part?.text?.trim() || '')
      .filter(Boolean)
      .join('\n')
      .trim();

    return sanitizeModelText(text);
  }

  return '';
}

function sanitizeModelText(text: string) {
  const normalized = text.trim();
  const withoutClosedThinking = normalized.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  if (withoutClosedThinking && !/^<think>/i.test(withoutClosedThinking)) {
    return withoutClosedThinking.replace(/<\/?think>/gi, '').trim();
  }

  if (/^<think>/i.test(normalized)) {
    return '';
  }

  return normalized.replace(/<think>[\s\S]*$/i, '').replace(/<\/?think>/gi, '').trim();
}

function getLanguageDirective(languageCode: string) {
  const directives: Record<string, string> = {
    'en-IN': 'Respond only in Indian English.',
    'hi-IN': 'Respond only in Hindi using Devanagari script. Do not answer in English except for unavoidable proper nouns, units, or API names.',
    'as-IN': 'Respond only in Assamese using Assamese script.',
    'bn-IN': 'Respond only in Bengali using Bengali script.',
    'brx-IN': 'Respond only in Bodo using Devanagari script.',
    'doi-IN': 'Respond only in Dogri using Devanagari script.',
    'gu-IN': 'Respond only in Gujarati using Gujarati script.',
    'kn-IN': 'Respond only in Kannada using Kannada script.',
    'ks-IN': 'Respond only in Kashmiri using Perso-Arabic script where appropriate.',
    'kok-IN': 'Respond only in Konkani using Devanagari script.',
    'mai-IN': 'Respond only in Maithili using Devanagari script.',
    'ml-IN': 'Respond only in Malayalam using Malayalam script.',
    'mni-IN': 'Respond only in Manipuri using Meetei Mayek or Bengali script as appropriate.',
    'mr-IN': 'Respond only in Marathi using Devanagari script.',
    'ne-IN': 'Respond only in Nepali using Devanagari script.',
    'od-IN': 'Respond only in Odia using Odia script.',
    'pa-IN': 'Respond only in Punjabi using Gurmukhi script.',
    'sa-IN': 'Respond only in Sanskrit using Devanagari script.',
    'sat-IN': 'Respond only in Santali using Ol Chiki script where appropriate.',
    'sd-IN': 'Respond only in Sindhi using Perso-Arabic script where appropriate.',
    'ta-IN': 'Respond only in Tamil using Tamil script.',
    'te-IN': 'Respond only in Telugu using Telugu script.',
    'ur-IN': 'Respond only in Urdu using Urdu script.',
  };

  return directives[languageCode] || `Respond only in ${getLanguageLabel(languageCode)}.`;
}

function withLanguageDirective(messages: ChatMessage[], languageCode: string) {
  if (!languageCode || languageCode === 'auto') {
    return messages;
  }

  return [
    {
      role: 'system' as const,
      content:
        `Strict response language rule: ${getLanguageDirective(languageCode)} ` +
        'Use the native script for that language. Translate labels and explanations into that language even when source data is English.',
    },
    ...messages,
  ];
}

export function detectLanguage(text: string): SupportedLanguageCode {
  if (/[\u1C50-\u1C7F]/.test(text)) return 'sat-IN';
  if (/[\uABC0-\uABFF]/.test(text)) return 'mni-IN';
  if (/[\u0600-\u06FF]/.test(text)) return 'ur-IN';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN';
  if (/[\u0B00-\u0B7F]/.test(text)) return 'od-IN';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN';

  if (/[\u0900-\u097F]/.test(text)) {
    return MARATHI_WORD_HINTS.test(text) || MARATHI_HINTS.test(text) ? 'mr-IN' : 'hi-IN';
  }

  return 'en-IN';
}

export function getLanguageLabel(languageCode: SupportedLanguageCode | string) {
  return SUPPORTED_LANGUAGES.find((language) => language.code === languageCode)?.label || languageCode;
}

function getNormalizedChatModel(modelCode?: string): SarvamChatModelCode {
  return SARVAM_CHAT_MODELS.some((model) => model.code === modelCode)
    ? (modelCode as SarvamChatModelCode)
    : SARVAM_MODEL;
}

export function getSarvamModelLabel(modelCode?: string) {
  return SARVAM_MODEL_COVERAGE.find((model) => model.code === modelCode)?.label || modelCode || 'Sarvam AI';
}

function shouldTranslateFinalAnswer(text: string, languageCode: string) {
  if (!text || languageCode === 'auto' || languageCode === 'en-IN') {
    return false;
  }

  const scriptTest = LANGUAGE_SCRIPT_TESTS[languageCode as SupportedLanguageCode];
  if (!scriptTest) {
    return false;
  }

  return !scriptTest.test(text);
}

function getTranslationModel(languageCode: string) {
  return MAYURA_LANGUAGE_CODES.has(languageCode) ? 'mayura:v1' : 'sarvam-translate:v1';
}

function chunkTranslationText(text: string) {
  if (text.length <= TRANSLATION_CHUNK_CHARS) {
    return [text];
  }

  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;

    if (next.length <= TRANSLATION_CHUNK_CHARS) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (paragraph.length <= TRANSLATION_CHUNK_CHARS) {
      current = paragraph;
      continue;
    }

    for (let index = 0; index < paragraph.length; index += TRANSLATION_CHUNK_CHARS) {
      chunks.push(paragraph.slice(index, index + TRANSLATION_CHUNK_CHARS).trim());
    }
    current = '';
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.filter(Boolean);
}

async function translateChunk(input: string, targetLanguageCode: string) {
  const model = getTranslationModel(targetLanguageCode);
  const sourceLanguageCode = model === 'sarvam-translate:v1' ? 'en-IN' : 'auto';
  let data: SarvamTranslateResponse | null = null;

  if (shouldUseSecureApi()) {
    try {
      data = await fetchSecureJson<SarvamTranslateResponse>('/sarvam-translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input,
          source_language_code: sourceLanguageCode,
          target_language_code: targetLanguageCode,
          model,
          mode: 'formal',
        }),
      });
    } catch (error) {
      if (!canUseLocalProviderKey()) {
        throw error;
      }
    }
  }

  if (!data) {
    const apiKey = getApiKey();
    const response = await fetchWithTimeout(SARVAM_TRANSLATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        input,
        source_language_code: sourceLanguageCode,
        target_language_code: targetLanguageCode,
        model,
        mode: 'formal',
      }),
    });

    try {
      data = (await response.json()) as SarvamTranslateResponse;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const details = data?.error?.message || JSON.stringify(data) || response.statusText;
      throw new Error(`Sarvam translation failed with ${response.status}: ${details}`);
    }
  }

  if (data?.error?.message) {
    throw new Error(`Sarvam translation error: ${data.error.message}`);
  }

  if (!data?.translated_text?.trim()) {
    throw new Error('Sarvam translation returned no translated text.');
  }

  return data.translated_text.trim();
}

async function ensureTargetLanguage(text: string, languageCode: string) {
  if (!shouldTranslateFinalAnswer(text, languageCode)) {
    return text;
  }

  try {
    const translated = await Promise.all(
      chunkTranslationText(text).map((chunk) => translateChunk(chunk, languageCode))
    );
    return translated.join('\n\n').trim() || text;
  } catch {
    return text;
  }
}

function normalizeTtsText(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[*_#`]/g, '')
    .trim();
}

function chunkTtsText(text: string, maxLength = MAX_TTS_CHARS) {
  const normalized = normalizeTtsText(text);

  if (normalized.length <= maxLength) {
    return [normalized];
  }

  const sentences = normalized.split(/(?<=[.!?।])/u).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
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

function decodeBase64Audio(base64Audio: string) {
  const audioBinary = atob(base64Audio);
  return Uint8Array.from(audioBinary, (character) => character.charCodeAt(0));
}

function readAscii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function readUint32LE(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function writeUint32LE(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function parseWav(bytes: Uint8Array) {
  if (readAscii(bytes, 0, 4) !== 'RIFF' || readAscii(bytes, 8, 4) !== 'WAVE') {
    throw new Error('Sarvam TTS returned audio in an unexpected format.');
  }

  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = readUint32LE(bytes, offset + 4);
    const dataStart = offset + 8;

    if (chunkId === 'data') {
      return {
        header: bytes.slice(0, dataStart),
        data: bytes.slice(dataStart, dataStart + chunkSize),
        dataSizeOffset: offset + 4,
      };
    }

    offset = dataStart + chunkSize + (chunkSize % 2);
  }

  throw new Error('Sarvam TTS returned WAV audio without a data chunk.');
}

function mergeWavAudio(parts: Uint8Array[]) {
  if (parts.length === 1) {
    return parts[0];
  }

  const parsedParts = parts.map(parseWav);
  const header = parsedParts[0].header.slice();
  const totalDataLength = parsedParts.reduce((sum, part) => sum + part.data.length, 0);
  const merged = new Uint8Array(header.length + totalDataLength);
  let offset = header.length;

  writeUint32LE(header, 4, merged.length - 8);
  writeUint32LE(header, parsedParts[0].dataSizeOffset, totalDataLength);
  merged.set(header, 0);

  for (const part of parsedParts) {
    merged.set(part.data, offset);
    offset += part.data.length;
  }

  return merged;
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const [, base64] = result.split(',');
      resolve(base64 || '');
    };
    reader.onerror = () => reject(new Error('Unable to read recorded voice audio.'));
    reader.readAsDataURL(blob);
  });
}

function normalizeAudioMimeType(value: string) {
  return value.split(';')[0]?.trim().toLowerCase() || 'audio/webm';
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: init.signal || controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function sendChat(messages: ChatMessage[], languageCode: string, modelCode?: SarvamChatModelCode) {
  const guidedMessages = withLanguageDirective(messages, languageCode);
  const model = getNormalizedChatModel(modelCode);

  if (shouldUseSecureApi()) {
    try {
      const data = await fetchSecureJson<SarvamResponse>('/sarvam-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: guidedMessages,
          temperature: 0.35,
          max_tokens: SARVAM_MAX_TOKENS,
          reasoning_effort: SARVAM_REASONING_EFFORT,
        }),
      });
      const text = await ensureTargetLanguage(extractText(data), languageCode);

      if (!text) {
        throw new Error('Sarvam returned reasoning-only output without a final answer.');
      }

      return {
        text,
        languageCode,
        modelCode: model,
      };
    } catch (error) {
      if (!canUseLocalProviderKey()) {
        throw error;
      }
    }
  }

  const apiKey = getApiKey();

  const response = await fetchWithTimeout(SARVAM_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: guidedMessages,
      temperature: 0.35,
      max_tokens: SARVAM_MAX_TOKENS,
      reasoning_effort: SARVAM_REASONING_EFFORT,
    }),
  });

  let data: SarvamResponse | null = null;
  try {
    data = (await response.json()) as SarvamResponse;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const details = data?.error?.message || JSON.stringify(data) || response.statusText;
    if (response.status === 429) {
      throw new Error('Sarvam AI rate limit reached. DRKA is using local fallback mode until the quota resets.');
    }
    throw new Error(`Sarvam chat failed with ${response.status}: ${details}`);
  }

  if (data?.error?.message) {
    throw new Error(data.error.message);
  }

  if (!data) {
    throw new Error('Sarvam chat returned an empty response body.');
  }

  const text = await ensureTargetLanguage(extractText(data), languageCode);

  if (!text) {
    throw new Error('Sarvam returned reasoning-only output without a final answer.');
  }

  return {
    text,
    languageCode,
    modelCode: model,
  };
}

export async function transcribeSpeech(
  audio: Blob,
  languageCode: string,
  mode: 'transcribe' | 'translate' | 'verbatim' | 'translit' | 'codemix' = 'transcribe'
) {
  const normalizedLanguageCode = languageCode && languageCode !== 'auto' ? languageCode : 'unknown';
  const mimeType = normalizeAudioMimeType(audio.type || 'audio/webm');
  const fileExtension = mimeType.includes('wav') ? 'wav' : mimeType.includes('ogg') ? 'ogg' : 'webm';

  if (shouldUseSecureApi()) {
    try {
      const data = await fetchSecureJson<SarvamAsrResponse>(
        '/sarvam-asr',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audioBase64: await blobToBase64(audio),
            mimeType,
            fileName: `drka-voice.${fileExtension}`,
            model: 'saaras:v3',
            mode,
            language_code: normalizedLanguageCode,
          }),
        },
        35000
      );

      if (data.error?.message) {
        throw new Error(data.error.message);
      }

      if (!data.transcript?.trim()) {
        throw new Error('Saaras V3 returned no transcript.');
      }

      return {
        transcript: data.transcript.trim(),
        languageCode: data.language_code || languageCode,
        languageProbability: data.language_probability ?? null,
      };
    } catch (error) {
      if (!canUseLocalProviderKey()) {
        throw error;
      }
    }
  }

  const apiKey = getApiKey();
  const formData = new FormData();
  const normalizedAudio = audio.type === mimeType ? audio : new Blob([audio], { type: mimeType });
  formData.append('file', normalizedAudio, `drka-voice.${fileExtension}`);
  formData.append('model', 'saaras:v3');
  formData.append('mode', mode);
  formData.append('language_code', normalizedLanguageCode);

  const response = await fetchWithTimeout(
    SARVAM_ASR_URL,
    {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
      },
      body: formData,
    },
    35000
  );

  let data: SarvamAsrResponse | null = null;
  try {
    data = (await response.json()) as SarvamAsrResponse;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const details = data?.error?.message || JSON.stringify(data) || response.statusText;
    throw new Error(`Saaras V3 transcription failed with ${response.status}: ${details}`);
  }

  if (data?.error?.message) {
    throw new Error(`Saaras V3 error: ${data.error.message}`);
  }

  if (!data?.transcript?.trim()) {
    throw new Error('Saaras V3 returned no transcript.');
  }

  return {
    transcript: data.transcript.trim(),
    languageCode: data.language_code || languageCode,
    languageProbability: data.language_probability ?? null,
  };
}

export async function speakText(text: string, languageCode: string, speaker: string) {
  if (!BULBUL_TTS_LANGUAGE_CODES.has(languageCode)) {
    throw new Error(`Bulbul V3 TTS does not support ${getLanguageLabel(languageCode)} yet. Falling back to browser voice.`);
  }

  const chunks = chunkTtsText(text);
  const audioParts: Uint8Array[] = [];
  const useSecureApi = shouldUseSecureApi();

  for (const chunk of chunks) {
    let data: SarvamAudioResponse | null = null;

    if (useSecureApi) {
      try {
        data = await fetchSecureJson<SarvamAudioResponse>('/sarvam-tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: chunk,
            target_language_code: languageCode,
            speaker,
            model: 'bulbul:v3',
            pace: 1,
          }),
        });
      } catch (error) {
        if (!canUseLocalProviderKey()) {
          throw error;
        }
      }
    }

    if (!data) {
      const apiKey = getApiKey();
      const response = await fetchWithTimeout(SARVAM_TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': apiKey,
        },
        body: JSON.stringify({
          text: chunk,
          target_language_code: languageCode,
          speaker,
          model: 'bulbul:v3',
          pace: 1,
        }),
      });

      try {
        data = (await response.json()) as SarvamAudioResponse;
      } catch {
        data = null;
      }

      if (!response.ok) {
        const details = data?.error?.message || JSON.stringify(data) || response.statusText;
        if (response.status === 429) {
          throw new Error('Sarvam TTS rate limit reached. Voice playback will work again when the quota resets.');
        }
        throw new Error(`Sarvam TTS failed with ${response.status}: ${details}`);
      }
    }

    if (data?.error?.message) {
      throw new Error(`Sarvam TTS error: ${data.error.message}`);
    }

    const base64Audio = data?.audios?.[0] || data?.audio;

    if (!base64Audio) {
      throw new Error('Sarvam TTS returned no audio data.');
    }

    audioParts.push(decodeBase64Audio(base64Audio));
  }

  const blob = new Blob([mergeWavAudio(audioParts)], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}
