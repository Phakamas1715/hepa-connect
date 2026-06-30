import { randomUUID } from "node:crypto";
import { serverEnv } from "./server-env";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  route?: string;
  action?: string;
  hn?: string;
  [key: string]: unknown;
}

const isProd = (serverEnv("NODE_ENV") || process.env.NODE_ENV) === "production";

function maskHn(hn?: string): string | undefined {
  if (!hn) return undefined;
  if (hn.length <= 4) return "****";
  return hn.slice(0, 2) + "****" + hn.slice(-2);
}

function formatValue(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v === "string" && v.length > 200) return v.slice(0, 200) + "...";
  if (typeof v === "object") {
    try {
      const s = JSON.stringify(v);
      return s.length > 300 ? s.slice(0, 300) + "..." : s;
    } catch {
      return "[object]";
    }
  }
  return v;
}

function write(level: LogLevel, msg: string, ctx: LogContext = {}) {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...Object.fromEntries(
      Object.entries(ctx).map(([k, v]) => [
        k,
        k === "hn" ? maskHn(String(v)) : formatValue(v),
      ])
    ),
  };

  const line = isProd ? JSON.stringify(entry) : JSON.stringify(entry, null, 2);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function createLogger(baseCtx: LogContext = {}) {
  const base: LogContext = { ...baseCtx };

  return {
    debug(msg: string, extra?: LogContext) {
      if (!isProd) write("debug", msg, { ...base, ...extra });
    },
    info(msg: string, extra?: LogContext) {
      write("info", msg, { ...base, ...extra });
    },
    warn(msg: string, extra?: LogContext) {
      write("warn", msg, { ...base, ...extra });
    },
    error(msg: string, extra?: LogContext | Error) {
      if (extra instanceof Error) {
        write("error", msg, {
          ...base,
          error: extra.message,
          stack: isProd ? undefined : extra.stack,
        });
      } else {
        write("error", msg, { ...base, ...extra });
      }
    },
    child(extra: LogContext) {
      return createLogger({ ...base, ...extra });
    },
  };
}

export function newRequestId(): string {
  return randomUUID().slice(0, 12);
}

export const rootLogger = createLogger({ service: "hepa-connect" });
