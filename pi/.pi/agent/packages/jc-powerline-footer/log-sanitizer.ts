import { homedir } from "node:os";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replacePathPrefix(value: string, prefix: string, replacement: string): string {
  if (!prefix) return value;
  return value.replace(new RegExp(escapeRegExp(prefix), "g"), replacement);
}

export function sanitizePathForLog(value: string): string {
  let sanitized = value;
  sanitized = replacePathPrefix(sanitized, process.cwd(), "[cwd]");
  sanitized = replacePathPrefix(sanitized, process.env.HOME || process.env.USERPROFILE || homedir(), "~");
  return sanitized;
}

export function sanitizeErrorForLog(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${sanitizePathForLog(error.message)}`;
  }
  return sanitizePathForLog(String(error));
}
