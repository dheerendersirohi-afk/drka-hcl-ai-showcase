import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Bot, Loader, Mic, MicOff, X, Minimize2, Maximize2, Volume2, VolumeX, Square } from 'lucide-react';
import { useDisasterStore } from '../store/disaster';
import { generateChatResponse } from '../lib/gemini';
import { logger } from '../lib/logger';
import { detectSarvamLanguage, getLanguageLabel, SARVAM_TTS_SPEAKERS } from '../lib/sarvamLanguages';
import { playSarvamSpeech } from '../lib/sarvamTts';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  languageCode?: string;
}

const PRESET_PROMPTS = [
  {
    title: 'Current Situation Overview',
    prompt: 'Give me a summary of all active disasters and their current status'
  },
  {
    title: 'Resource Analysis',
    prompt: 'What is the current status of our resources and where are they deployed?'
  },
  {
    title: 'Team Deployment Status',
    prompt: 'Show me the status of all emergency response teams'
  },
  {
    title: 'Critical Alerts',
    prompt: 'What are the most critical alerts right now?'
  }
];

interface AIChatProps {
  onClose?: () => void;
}

type SpeechRecognitionConstructor = {
  new (): SpeechRecognitionInstance;
};

type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  0: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
};

type SpeechRecognitionEventLike = Event & {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
  message?: string;
};

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export default function AIChat({ onClose }: AIChatProps) {
  const disasters = useDisasterStore((state) => state.disasters);
  const resources = useDisasterStore((state) => state.resources);
  const teams = useDisasterStore((state) => state.teams);
  const alerts = useDisasterStore((state) => state.alerts);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your AI assistant. I can help you analyze disasters, check resource status, and provide real-time insights. How can I help you today?",
      timestamp: new Date(),
      languageCode: 'en-IN'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechInputSupported, setSpeechInputSupported] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState('en-IN');
  const [selectedSpeaker, setSelectedSpeaker] = useState('shubh');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const stopSpeaking = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }

    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }

    setIsSpeaking(false);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const speakText = useCallback(async (text: string, languageCode = activeLanguage) => {
    if (!text.trim()) {
      return;
    }

    try {
      await playSarvamSpeech(
        {
          text,
          languageCode,
          speaker: selectedSpeaker,
        },
        currentAudioRef,
        currentAudioUrlRef,
        setIsSpeaking
      );
    } catch (error) {
      logger.error('Sarvam TTS playback failed', error);
      setIsSpeaking(false);
    }
  }, [activeLanguage, selectedSpeaker]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      return;
    }

    try {
      recognitionRef.current.lang = activeLanguage;
      recognitionRef.current.start();
    } catch (error) {
      logger.error('Speech recognition start failed', error);
      setIsListening(false);
    }
  }, [activeLanguage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => stopSpeaking, [stopSpeaking]);

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) {
      return;
    }

    const recognition = new Recognition();
    recognition.lang = activeLanguage;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event) => {
      logger.error('Speech recognition failed', event);
      setIsListening(false);
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();

      if (transcript) {
        setInput(transcript);
      }
    };

    recognitionRef.current = recognition;
    setSpeechInputSupported(true);

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [activeLanguage]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
        setIsMinimized(true);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isVoiceEnabled) {
      return;
    }

    const latestAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');

    if (latestAssistantMessage) {
      void speakText(latestAssistantMessage.content, latestAssistantMessage.languageCode || activeLanguage);
    }
  }, [activeLanguage, isVoiceEnabled, messages, speakText]);

  const handleSend = async (promptText: string = input) => {
    if (!promptText.trim() && !input.trim()) {
      return;
    }

    const outgoingPrompt = promptText || input;
    const detectedLanguage = detectSarvamLanguage(outgoingPrompt);
    setActiveLanguage(detectedLanguage);

    const userMessage: Message = {
      role: 'user',
      content: outgoingPrompt,
      timestamp: new Date(),
      languageCode: detectedLanguage,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await generateChatResponse({
        prompt: outgoingPrompt,
        context: {
          disasters,
          resources,
          teams,
          alerts
        },
        languageCode: detectedLanguage,
        languageLabel: getLanguageLabel(detectedLanguage),
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        languageCode: detectedLanguage,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      logger.error('Failed to get AI response', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error while processing your request. Please try again.',
        timestamp: new Date(),
        languageCode: detectedLanguage,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="glass rounded-xl p-4 flex items-center space-x-3 hover:bg-white/5 transition-colors"
      >
        <Bot className="w-6 h-6 text-blue-400" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white">AI Assistant</h2>
          <p className="text-sm text-gray-400">
            {isSpeaking ? 'Speaking with Sarvam TTS...' : isListening ? 'Listening for speech...' : 'Click to expand'}
          </p>
        </div>
        <Maximize2 className="w-5 h-5 text-gray-400" />
      </button>
    );
  }

  return (
    <div
      ref={chatRef}
      className="glass rounded-xl overflow-hidden flex flex-col h-[600px] sm:h-[500px] md:h-[600px] w-full sm:max-w-md md:max-w-lg lg:max-w-xl"
    >
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Bot className="w-6 h-6 text-blue-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">AI Assistant</h2>
            <p className="text-sm text-gray-400">
              Powered by Sarvam AI · Auto language: {getLanguageLabel(activeLanguage)} · {selectedSpeaker}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsVoiceEnabled((current) => !current)}
            className={`p-2 transition-colors ${
              isVoiceEnabled ? 'text-blue-300 hover:text-white' : 'text-gray-400 hover:text-white'
            }`}
            title={isVoiceEnabled ? 'Disable voice output' : 'Enable voice output'}
          >
            {isVoiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Stop speaking"
            >
              <Square className="w-4 h-4" />
            </button>
          )}
          {speechInputSupported && (
            <button
              onClick={isListening ? stopListening : startListening}
              className={`p-2 transition-colors ${
                isListening ? 'text-red-300 hover:text-white' : 'text-gray-400 hover:text-white'
              }`}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 border-b border-white/10 overflow-x-auto">
        <div className="mb-3">
          <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">
            Sarvam Voice
          </label>
          <select
            value={selectedSpeaker}
            onChange={(e) => setSelectedSpeaker(e.target.value)}
            className="w-full bg-black/20 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
          >
            {SARVAM_TTS_SPEAKERS.map((speaker) => (
              <option key={speaker.code} value={speaker.code} className="text-black">
                {speaker.label}
              </option>
            ))}
          </select>
        </div>
        {speechInputSupported && (
          <p className="mb-3 text-xs text-gray-400">
            {isListening ? 'Listening... speak now.' : 'Mic input available for supported browsers.'}
          </p>
        )}
        <div className="flex gap-2">
          {PRESET_PROMPTS.map((preset, index) => (
            <button
              key={index}
              onClick={() => handleSend(preset.prompt)}
              className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-sm transition-all hover-lift whitespace-nowrap"
            >
              {preset.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-blue-500/20 text-blue-100'
                  : 'glass text-gray-200'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="mb-2 flex justify-end">
                  <button
                    onClick={() => void speakText(message.content, message.languageCode || activeLanguage)}
                    className="text-xs text-blue-300 hover:text-white transition-colors flex items-center gap-1"
                    title="Play voice output"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Speak</span>
                  </button>
                </div>
              )}
              <p className="whitespace-pre-line text-sm sm:text-base">{message.content}</p>
              <span className="text-xs text-gray-400 mt-1 block">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="glass rounded-lg p-3 flex items-center space-x-2">
              <Loader className="w-4 h-4 animate-spin text-blue-400" />
              <span className="text-gray-300">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-white/10">
        <div className="flex space-x-2">
          {speechInputSupported && (
            <button
              onClick={isListening ? stopListening : startListening}
              className={`px-4 py-2 rounded-lg transition-all hover-lift ${
                isListening
                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300'
                  : 'bg-white/10 hover:bg-white/15 text-white'
              }`}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
            placeholder="Ask me anything about the current situation..."
            className="flex-1 bg-black/20 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm sm:text-base"
          />
          <button
            onClick={() => void handleSend()}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all hover-lift disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
