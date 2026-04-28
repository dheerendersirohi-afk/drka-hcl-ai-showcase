import { logger } from './logger';

const apiKey = import.meta.env.VITE_SARVAM_API_KEY;
const ttsApiUrl = 'https://api.sarvam.ai/text-to-speech';

type SarvamTtsResponse = {
  request_id?: string | null;
  audios?: string[];
  error?: {
    message?: string;
    code?: string;
    request_id?: string;
  };
};

function decodeBase64ToBytes(base64: string) {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes;
}

export async function generateSarvamSpeech({
  text,
  languageCode,
  speaker,
}: {
  text: string;
  languageCode: string;
  speaker: string;
}) {
  if (!apiKey) {
    throw new Error('Missing Sarvam API key. Set VITE_SARVAM_API_KEY in your .env file.');
  }

  const response = await fetch(ttsApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
    },
    body: JSON.stringify({
      text,
      target_language_code: languageCode,
      model: 'bulbul:v3',
      speaker,
      pace: 1.0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Sarvam TTS request failed: ${response.status} ${errorText}`);
  }

  const data: SarvamTtsResponse = await response.json();

  if (data.error?.message) {
    throw new Error(`Sarvam TTS error: ${data.error.message}`);
  }

  const base64Audio = data.audios?.[0];

  if (!base64Audio) {
    throw new Error('Sarvam TTS returned no audio data.');
  }

  const audioBytes = decodeBase64ToBytes(base64Audio);
  return new Blob([audioBytes], { type: 'audio/wav' });
}

export async function playSarvamSpeech(
  options: {
    text: string;
    languageCode: string;
    speaker: string;
  },
  currentAudioRef: React.MutableRefObject<HTMLAudioElement | null>,
  currentUrlRef: React.MutableRefObject<string | null>,
  setIsSpeaking: (value: boolean) => void
) {
  try {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }

    const audioBlob = await generateSarvamSpeech(options);
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    currentAudioRef.current = audio;
    currentUrlRef.current = audioUrl;

    audio.onended = () => {
      setIsSpeaking(false);
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = null;
      }
      currentAudioRef.current = null;
    };

    audio.onerror = (event) => {
      logger.error('Sarvam TTS audio playback failed', event);
      setIsSpeaking(false);
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = null;
      }
      currentAudioRef.current = null;
    };

    setIsSpeaking(true);
    await audio.play();
  } catch (error) {
    setIsSpeaking(false);
    throw error;
  }
}
