import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { GitStatus } from "./types.ts";

interface CachedGitStatus {
  staged: number;
  unstaged: number;
  untracked: number;
  timestamp: number;
}

interface CachedBranch {
  branch: string | null;
  timestamp: number;
}

interface GitCacheBucket {
  cachedStatus: CachedGitStatus | null;
  cachedBranch: CachedBranch | null;
  pendingFetch: Promise<void> | null;
  pendingBranchFetch: Promise<void> | null;
  invalidationCounter: number;
  branchInvalidationCounter: number;
}

export type GitPollingMode = "full" | "branch" | "off";

const CACHE_TTL_MS = 1000; // 1 second for file status
const BRANCH_TTL_MS = 500; // Shorter TTL so branch updates quickly after invalidation
const cacheByCwd = new Map<string, GitCacheBucket>();

function createBucket(): GitCacheBucket {
  return {
    cachedStatus: null,
    cachedBranch: null,
    pendingFetch: null,
    pendingBranchFetch: null,
    invalidationCounter: 0,
    branchInvalidationCounter: 0,
  };
}

function normalizeCwd(cwd?: string | null): string {
  return resolve(cwd || process.cwd());
}

function getBucket(cwd: string): GitCacheBucket {
  let bucket = cacheByCwd.get(cwd);
  if (!bucket) {
    bucket = createBucket();
    cacheByCwd.set(cwd, bucket);
  }
  return bucket;
}

function emptyGitStatus(branch: string | null): GitStatus {
  return { branch, staged: 0, unstaged: 0, untracked: 0 };
}

function cachedStatusWithBranch(branch: string | null, cachedStatus: CachedGitStatus): GitStatus {
  return {
    branch,
    staged: cachedStatus.staged,
    unstaged: cachedStatus.unstaged,
    untracked: cachedStatus.untracked,
  };
}

/**
 * Parse git status --porcelain output
 *
 * Format: XY filename
 * X = index status, Y = working tree status
 * ?? = untracked
 * Other X values = staged
 * Other Y values = unstaged
 */
function parseGitStatusOutput(output: string): { staged: number; unstaged: number; untracked: number } {
  let staged = 0;
  let unstaged = 0;
  let untracked = 0;

  for (const line of output.split("\n")) {
    if (!line) continue;
    const x = line[0];
    const y = line[1];

    if (x === "?" && y === "?") {
      untracked++;
      continue;
    }

    // X position (index/staged)
    if (x && x !== " " && x !== "?") {
      staged++;
    }

    // Y position (working tree/unstaged)
    if (y && y !== " ") {
      unstaged++;
    }
  }

  return { staged, unstaged, untracked };
}

function cacheFetchedStatus(bucket: GitCacheBucket, fetchId: number, result: { staged: number; unstaged: number; untracked: number } | null): void {
  if (fetchId !== bucket.invalidationCounter) return;
  bucket.cachedStatus = {
    ...(result ?? { staged: 0, unstaged: 0, untracked: 0 }),
    timestamp: Date.now(),
  };
}

function runGit(args: string[], cwd: string, timeoutMs = 200): Promise<string | null> {
  return new Promise((resolveResult) => {
    const proc = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let resolved = false;

    const timeoutId = setTimeout(() => {
      proc.kill();
      finish(null);
    }, timeoutMs);

    const finish = (result: string | null) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      resolveResult(result);
    };

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.on("close", (code) => {
      finish(code === 0 ? stdout.trim() : null);
    });

    proc.on("error", () => {
      finish(null);
    });
  });
}

/**
 * Fetch current git branch asynchronously.
 * For detached HEAD, returns the short commit SHA (matches provider's "detached" behavior).
 */
async function fetchGitBranch(cwd: string): Promise<string | null> {
  const branch = await runGit(["branch", "--show-current"], cwd);
  if (branch === null) return null;
  if (branch) return branch;

  const sha = await runGit(["rev-parse", "--short", "HEAD"], cwd);
  return sha ? `${sha} (detached)` : "detached";
}

/**
 * Fetch git status asynchronously
 */
async function fetchGitStatus(cwd: string): Promise<{ staged: number; unstaged: number; untracked: number } | null> {
  const output = await runGit(["status", "--porcelain"], cwd, 500);
  if (output === null) return null;
  return parseGitStatusOutput(output);
}

/**
 * Get the current git branch with caching.
 * Falls back to provider branch if our cache is empty.
 */
export function getCurrentBranch(providerBranch: string | null, cwd?: string | null): string | null {
  const normalizedCwd = normalizeCwd(cwd);
  const bucket = getBucket(normalizedCwd);
  const now = Date.now();

  // Return cached if fresh
  if (bucket.cachedBranch && now - bucket.cachedBranch.timestamp < BRANCH_TTL_MS) {
    return bucket.cachedBranch.branch;
  }

  // Trigger background fetch if not already pending
  if (!bucket.pendingBranchFetch) {
    const fetchId = bucket.branchInvalidationCounter;
    bucket.pendingBranchFetch = fetchGitBranch(normalizedCwd).then((result) => {
      // Cache result if no invalidation happened (including null for non-git dirs)
      if (fetchId === bucket.branchInvalidationCounter) {
        bucket.cachedBranch = {
          branch: result,
          timestamp: Date.now(),
        };
      }
      bucket.pendingBranchFetch = null;
    });
  }

  // Return stale cache while refreshing; only use provider before first fetch
  return bucket.cachedBranch ? bucket.cachedBranch.branch : providerBranch;
}

/**
 * Get git status with caching.
 * Returns cached value if within TTL, otherwise triggers async fetch.
 * This is designed for synchronous render() calls - returns last known value
 * while refreshing in background.
 */
export function getGitStatus(providerBranch: string | null, pollingMode: GitPollingMode = "full", cwd?: string | null): GitStatus {
  const normalizedCwd = normalizeCwd(cwd);
  const bucket = getBucket(normalizedCwd);
  const now = Date.now();
  const branch = pollingMode === "off" ? providerBranch : getCurrentBranch(providerBranch, normalizedCwd);

  if (pollingMode !== "full") {
    return emptyGitStatus(branch);
  }

  // Return cached if fresh
  if (bucket.cachedStatus && now - bucket.cachedStatus.timestamp < CACHE_TTL_MS) {
    return cachedStatusWithBranch(branch, bucket.cachedStatus);
  }

  // Trigger background fetch if not already pending
  if (!bucket.pendingFetch) {
    const fetchId = bucket.invalidationCounter; // Capture current counter
    bucket.pendingFetch = fetchGitStatus(normalizedCwd).then((result) => {
      // Cache result if no invalidation happened (including null for non-git dirs)
      cacheFetchedStatus(bucket, fetchId, result);
      bucket.pendingFetch = null;
    });
  }

  // Return last cached or empty
  if (bucket.cachedStatus) {
    return cachedStatusWithBranch(branch, bucket.cachedStatus);
  }

  return emptyGitStatus(branch);
}

/**
 * Force refresh git status (call when you know files changed)
 */
export function invalidateGitStatus(cwd?: string | null): void {
  if (cwd) {
    const bucket = getBucket(normalizeCwd(cwd));
    bucket.cachedStatus = null;
    bucket.invalidationCounter++;
    return;
  }

  for (const bucket of cacheByCwd.values()) {
    bucket.cachedStatus = null;
    bucket.invalidationCounter++;
  }
}

/**
 * Force refresh git branch (call when you know branch might have changed)
 */
export function invalidateGitBranch(cwd?: string | null): void {
  if (cwd) {
    const bucket = getBucket(normalizeCwd(cwd));
    bucket.cachedBranch = null;
    bucket.branchInvalidationCounter++;
    return;
  }

  for (const bucket of cacheByCwd.values()) {
    bucket.cachedBranch = null;
    bucket.branchInvalidationCounter++;
  }
}
