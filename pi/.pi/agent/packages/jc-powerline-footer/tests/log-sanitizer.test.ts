import { describe, expect, test } from "bun:test";
import { sanitizeErrorForLog, sanitizePathForLog } from "../log-sanitizer.ts";

describe("log sanitizer", () => {
  test("redacts cwd and home paths", () => {
    const cwd = process.cwd();
    const home = process.env.HOME || "";
    const sanitized = sanitizePathForLog(`${cwd}/index.ts ${home}/.pi/agent/settings.json`);
    expect(sanitized).toContain("[cwd]/index.ts");
    if (home) expect(sanitized).toContain("~/.pi/agent/settings.json");
    expect(sanitized).not.toContain(cwd);
    if (home) expect(sanitized).not.toContain(`${home}/.pi`);
  });

  test("redacts paths inside errors", () => {
    const cwd = process.cwd();
    const error = new Error(`failed at ${cwd}/theme.json`);
    const sanitized = sanitizeErrorForLog(error);
    expect(sanitized).toContain("Error: failed at [cwd]/theme.json");
    expect(sanitized).not.toContain(cwd);
  });
});
