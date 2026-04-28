import { useEffect, useState } from 'react';
import { CloudSun, ExternalLink, RefreshCcw, Wind } from 'lucide-react';
import { ACCUWEATHER_SOURCE_URL, fetchWeatherSummary, type WeatherSummary } from '../lib/weather';

export default function WeatherPanel() {
  const [weather, setWeather] = useState<WeatherSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWeather = async (signal?: AbortSignal) => {
    setLoading(true);
    const summary = await fetchWeatherSummary(signal);
    setWeather(summary);
    setLoading(false);
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadWeather(controller.signal);
    return () => controller.abort();
  }, []);

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CloudSun className="w-5 h-5 text-sky-300" />
            <h2 className="text-xl font-semibold text-white">Weather Watch</h2>
          </div>
          <p className="text-sm text-gray-400">AccuWeather feed for Hapur, Uttar Pradesh</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadWeather()}
            className="p-2 rounded-lg bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Refresh weather"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a
            href={ACCUWEATHER_SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-lg bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Open AccuWeather"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {weather && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="glass-dark rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Current</p>
                  <p className="text-3xl font-bold text-white mt-1">{weather.currentTempF}°F</p>
                  <p className="text-sm text-sky-200 mt-1">{weather.condition}</p>
                </div>
                <div className="text-right text-sm text-gray-300">
                  <p>RealFeel {weather.realFeelF}°F</p>
                  <p className="mt-1">{weather.observedAt}</p>
                </div>
              </div>
            </div>

            <div className="glass-dark rounded-xl p-4">
              <p className="text-sm text-gray-400">Outlook</p>
              <p className="text-lg font-semibold text-white mt-1">
                Tonight {weather.tonightLowF}°F · Tomorrow {weather.tomorrowHighF}°F
              </p>
              <p className="text-sm text-gray-300 mt-2">{weather.tomorrowSummary}</p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Wind className="w-4 h-4 text-sky-300" />
              <span>{weather.wind}</span>
            </div>
            <span
              className={`text-xs uppercase tracking-wide px-2.5 py-1 rounded-full ${
                weather.source === 'live'
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : 'bg-amber-500/20 text-amber-200'
              }`}
            >
              {weather.source === 'live' ? 'Live page parse' : 'Snapshot fallback'}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm mb-5">
            <span className="text-gray-400">Air Quality</span>
            <span className="text-white font-medium">{weather.airQuality}</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm uppercase tracking-wide text-gray-400">Next Hours</h3>
              <span className="text-xs text-gray-500">Precipitation chance</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {weather.hourly.map((hour) => (
                <div key={hour.label} className="glass-dark rounded-lg p-3">
                  <p className="text-xs text-gray-400">{hour.label}</p>
                  <p className="text-lg font-semibold text-white mt-1">{hour.temperatureF}°F</p>
                  <p className="text-xs text-sky-200 mt-1">{hour.precipitationChance}% precip</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
