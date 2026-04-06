interface LogEntry {
  level: 'log' | 'info' | 'warn' | 'error';
  tag: string;
  message: string;
  meta: unknown[];
  timestamp: number;
}

const RING_BUFFER_SIZE = 100;
const ringBuffer: LogEntry[] = [];

const pushEntry = (entry: LogEntry) => {
  if (ringBuffer.length >= RING_BUFFER_SIZE) {
    ringBuffer.shift();
  }
  ringBuffer.push(entry);
};

const formatPrefix = (tag: string) => `[HisabKitab][${tag}]`;

export const logger = {
  log(tag: string, message: string, ...meta: unknown[]) {
    if (__DEV__) {
      console.log(formatPrefix(tag), message, ...meta);
    }
    // Production: silenced for log level
  },

  info(tag: string, message: string, ...meta: unknown[]) {
    if (__DEV__) {
      console.info(formatPrefix(tag), message, ...meta);
    }
    // Production: silenced for info level
  },

  warn(tag: string, message: string, ...meta: unknown[]) {
    const entry: LogEntry = { level: 'warn', tag, message, meta, timestamp: Date.now() };
    pushEntry(entry);
    if (__DEV__) {
      console.warn(formatPrefix(tag), message, ...meta);
    }
  },

  error(tag: string, message: string, ...meta: unknown[]) {
    const entry: LogEntry = { level: 'error', tag, message, meta, timestamp: Date.now() };
    pushEntry(entry);
    if (__DEV__) {
      console.error(formatPrefix(tag), message, ...meta);
    }
  },

  /** Get the last N entries from the in-memory ring buffer (for debug screen). */
  getRecentEntries(count = RING_BUFFER_SIZE): readonly LogEntry[] {
    return ringBuffer.slice(-count);
  },
} as const;
