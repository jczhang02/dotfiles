import { spawnSync } from "node:child_process";
for (const tool of ["apply-patch", "view-image", "imagegen"]) {
  const result = spawnSync(process.execPath, ["scripts/build-path-tool-binary.mjs", tool], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
