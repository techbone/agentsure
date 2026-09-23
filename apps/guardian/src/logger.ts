export type LogLevel = "debug" | "info" | "warn" | "error";
type LogFields = Record<string, unknown>;
type LogSink = (line: string) => void;

const SECRET_FIELD = /(private.?key|password|secret|seed|mnemonic)/i;
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function sanitize(value: unknown, key = ""): unknown {
  if (SECRET_FIELD.test(key)) {
    return "[REDACTED]";
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Error) {
    return { message: value.message, name: value.name };
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitize(childValue, childKey),
      ]),
    );
  }
  return value;
}

export class JsonLogger {
  readonly #sink: LogSink;
  readonly #minimumLevel: LogLevel;

  constructor(sink: LogSink = console.log, minimumLevel: LogLevel = "info") {
    this.#sink = sink;
    this.#minimumLevel = minimumLevel;
  }

  debug(message: string, fields: LogFields = {}): void {
    this.#write("debug", message, fields);
  }

  info(message: string, fields: LogFields = {}): void {
    this.#write("info", message, fields);
  }

  warn(message: string, fields: LogFields = {}): void {
    this.#write("warn", message, fields);
  }

  error(message: string, fields: LogFields = {}): void {
    this.#write("error", message, fields);
  }

  #write(level: LogLevel, message: string, fields: LogFields): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.#minimumLevel]) return;
    this.#sink(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...(sanitize(fields) as LogFields),
      }),
    );
  }
}
