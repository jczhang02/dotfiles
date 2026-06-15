import assert from "node:assert/strict";
import { test } from "node:test";

const moduleUrl = new URL("../agent-reach.ts", import.meta.url).href;
const {
  normalizeAgentReachParams,
  buildCommandForPlatform,
  formatAgentReachResults,
  formatCommandOutput,
  executeAgentReachSearch,
} = await import(moduleUrl);

const doctor = {
  twitter: { status: "ok", active_backend: "twitter-cli" },
  bilibili: { status: "ok", active_backend: "bili-cli" },
  github: { status: "ok", active_backend: "gh CLI" },
  youtube: { status: "ok", active_backend: "yt-dlp" },
  exa_search: { status: "ok", active_backend: "Exa via mcporter" },
  reddit: { status: "ok", active_backend: "OpenCLI" },
  xiaohongshu: { status: "ok", active_backend: "OpenCLI" },
};

test("normalizeAgentReachParams requires explicit platforms and clamps limit", () => {
  const params = normalizeAgentReachParams({
    query: "  hello  ",
    platforms: ["twitter", "nope", "twitter", "youtube"],
    limit: 999,
    raw: true,
  });

  assert.equal(params.query, "hello");
  assert.deepEqual(params.platforms, ["twitter", "youtube"]);
  assert.equal(params.limit, 20);
  assert.equal("raw" in params, false);

  const empty = normalizeAgentReachParams({ query: "hello" });
  assert.deepEqual(empty.platforms, []);
});

test("executeAgentReachSearch rejects missing platforms before doctor", async () => {
  const result = await executeAgentReachSearch({ query: "hello" });
  assert.match(result.content[0].text, /No platforms provided/);
  assert.equal(result.details.error, "No platforms provided");
});

test("executeAgentReachSearch rejects leading-dash queries before doctor", async () => {
  const result = await executeAgentReachSearch({ query: "--help", platforms: ["github_repos"] });
  assert.match(result.content[0].text, /Query cannot start with '-'/);
  assert.equal(result.details.error, "Query cannot start with '-'");
});

test("buildCommandForPlatform uses non-OpenCLI routes", () => {
  assert.deepEqual(
    buildCommandForPlatform("twitter", "pi", 3, doctor),
    { command: "twitter", args: ["search", "pi", "-n", "3", "--json"], backend: "twitter-cli" },
  );

  assert.deepEqual(
    buildCommandForPlatform("bilibili", "pi", 3, doctor),
    { command: "bili", args: ["search", "pi", "--type", "video", "-n", "3", "--json"], backend: "bili-cli" },
  );
});

test("buildCommandForPlatform refuses OpenCLI-only Reddit and Xiaohongshu", () => {
  const reddit = buildCommandForPlatform("reddit", "pi", 3, doctor);
  assert.equal(reddit.unavailable, true);
  assert.equal(reddit.backend, "OpenCLI");

  const xhs = buildCommandForPlatform("xiaohongshu", "pi", 3, doctor);
  assert.equal(xhs.unavailable, true);
  assert.equal(xhs.backend, "OpenCLI");
});

test("formatCommandOutput enforces requested limit and GitHub code shape", () => {
  const output = formatCommandOutput(JSON.stringify([
    { repository: { nameWithOwner: "owner/repo" }, path: "src/a.ts", url: "https://example/a" },
    { repository: { nameWithOwner: "owner/repo" }, path: "src/b.ts", url: "https://example/b" },
  ]), 1);

  assert.match(output, /owner\/repo:src\/a.ts/);
  assert.doesNotMatch(output, /src\/b.ts/);
});

test("formatAgentReachResults marks no OpenCLI policy", () => {
  const text = formatAgentReachResults("pi", 3, [
    { platform: "twitter", status: "ok", backend: "twitter-cli", text: "1. hello" },
    { platform: "reddit", status: "unavailable", backend: "OpenCLI", fix: "rdt-cli required" },
  ]);

  assert.match(text, /1\/2 sources OK/);
  assert.match(text, /OpenCLI not used/);
  assert.match(text, /rdt-cli required/);
});
