export type SarvamLanguage = {
  code: string;
  label: string;
};

export type SarvamSpeaker = {
  code: string;
  label: string;
};

export const SARVAM_LANGUAGES: SarvamLanguage[] = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'bn-IN', label: 'Bengali' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'pa-IN', label: 'Punjabi' },
  { code: 'od-IN', label: 'Odia' },
];

export const SARVAM_TTS_SPEAKERS: SarvamSpeaker[] = [
  { code: 'shubh', label: 'Shubh' },
  { code: 'aditya', label: 'Aditya' },
  { code: 'priya', label: 'Priya' },
  { code: 'rohan', label: 'Rohan' },
  { code: 'simran', label: 'Simran' },
  { code: 'kavya', label: 'Kavya' },
  { code: 'ishita', label: 'Ishita' },
  { code: 'anand', label: 'Anand' },
];

export function getLanguageLabel(code: string) {
  return SARVAM_LANGUAGES.find((language) => language.code === code)?.label || code;
}

export function detectSarvamLanguage(text: string) {
  const content = text.trim();

  if (!content) {
    return 'en-IN';
  }

  if (/[\u0980-\u09FF]/.test(content)) return 'bn-IN';
  if (/[\u0B80-\u0BFF]/.test(content)) return 'ta-IN';
  if (/[\u0C00-\u0C7F]/.test(content)) return 'te-IN';
  if (/[\u0C80-\u0CFF]/.test(content)) return 'kn-IN';
  if (/[\u0D00-\u0D7F]/.test(content)) return 'ml-IN';
  if (/[\u0A80-\u0AFF]/.test(content)) return 'gu-IN';
  if (/[\u0B00-\u0B7F]/.test(content)) return 'od-IN';
  if (/[\u0A00-\u0A7F]/.test(content)) return 'pa-IN';
  if (/[\u0900-\u097F]/.test(content)) {
    const devanagariMarathiHints = /\b(आहे|आणि|काय|तुम्ही|मदत|स्थिती)\b/u;
    return devanagariMarathiHints.test(content) ? 'mr-IN' : 'hi-IN';
  }

  return 'en-IN';
}
