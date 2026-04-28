type LogLevel = 'error' | 'warn' | 'info';

type LogEntry = {
  level: LogLevel;
  message: string;
  details?: unknown;
  timestamp: string;
};

declare global {
  interface Window {
    __DISASTER_HUB_LOGS__?: LogEntry[];
  }
}

function writeLog(level: LogLevel, message: string, details?: unknown) {
  if (typeof window === 'undefined') {
    return;
  }

  const logs = window.__DISASTER_HUB_LOGS__ || [];
  logs.push({
    level,
    message,
    details,
    timestamp: new Date().toISOString(),
  });
  window.__DISASTER_HUB_LOGS__ = logs.slice(-100);
}

export const logger = {
  error(message: string, details?: unknown) {
    writeLog('error', message, details);
  },
  warn(message: string, details?: unknown) {
    writeLog('warn', message, details);
  },
  info(message: string, details?: unknown) {
    writeLog('info', message, details);
  },
};
