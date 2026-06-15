import { chmodSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const toolsRoot = join(root, "src", "tools");
const map = {
  "apply-patch": { pkg: "codex-apply-patch", bin: "apply_patch", dir: "apply-patch" },
  "apply_patch": { pkg: "codex-apply-patch", bin: "apply_patch", dir: "apply-patch" },
  "view-image": { pkg: "codex-view-image", bin: "view_image", dir: "view-image" },
  "view_image": { pkg: "codex-view-image", bin: "view_image", dir: "view-image" },
  "imagegen": { pkg: "codex-imagegen", bin: "imagegen", dir: "imagegen" },
};
const requested = process.argv[2];
const tool = map[requested];
if (!tool) {
  console.error("Usage: node scripts/build-path-tool-binary.mjs <apply-patch|view-image|imagegen>");
  process.exit(2);
}
const build = spawnSync("cargo", ["build", "--release", "-p", tool.pkg, "--bin", tool.bin], {
  cwd: toolsRoot,
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);
const exe = process.platform === "win32" ? `${tool.bin}.exe` : tool.bin;
const platformArch = `${process.platform}-${process.arch}`;
const src = join(toolsRoot, "target", "release", exe);
const dest = join(toolsRoot, tool.dir, "bin", platformArch, exe);
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
if (process.platform !== "win32") chmodSync(dest, 0o755);
console.log(`built ${tool.bin} -> ${dest}`);
