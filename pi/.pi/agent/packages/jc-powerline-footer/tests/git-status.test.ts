import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { getGitStatus, invalidateGitBranch, invalidateGitStatus } from "../git-status.ts";

function makeRepo(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const init = spawnSync("git", ["init"], { cwd: dir, stdio: "ignore" });
  if (init.status !== 0) throw new Error("git init failed");
  return dir;
}

async function waitForStatus(cwd: string, predicate: (status: ReturnType<typeof getGitStatus>) => boolean) {
  let last = getGitStatus(null, "full", cwd);
  for (let i = 0; i < 20; i++) {
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 50));
    last = getGitStatus(null, "full", cwd);
  }
  return last;
}

describe("git status cache", () => {
  test("isolates status by cwd", async () => {
    const repoA = makeRepo("powerline-git-a-");
    const repoB = makeRepo("powerline-git-b-");
    writeFileSync(join(repoA, "dirty.txt"), "dirty\n", "utf8");
    invalidateGitStatus();
    invalidateGitBranch();

    const statusA = await waitForStatus(repoA, (status) => status.untracked === 1);
    expect(statusA.untracked).toBe(1);

    const initialB = getGitStatus(null, "full", repoB);
    expect(initialB.untracked).toBe(0);
    const statusB = await waitForStatus(repoB, (status) => status.untracked === 0);
    expect(statusB.untracked).toBe(0);
  });

  test("non-git cwd does not reuse dirty cache", async () => {
    const repo = makeRepo("powerline-git-dirty-");
    const nonGit = mkdtempSync(join(tmpdir(), "powerline-non-git-"));
    writeFileSync(join(repo, "dirty.txt"), "dirty\n", "utf8");
    invalidateGitStatus();
    invalidateGitBranch();

    const dirty = await waitForStatus(repo, (status) => status.untracked === 1);
    expect(dirty.untracked).toBe(1);

    const clean = await waitForStatus(nonGit, (status) => status.untracked === 0 && status.branch === null);
    expect(clean).toEqual({ branch: null, staged: 0, unstaged: 0, untracked: 0 });
  });
});
