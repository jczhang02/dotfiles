import { accessSync, constants, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const platformArch = `${process.platform}-${process.arch}`;
const tools = [
  ["apply-patch", "apply_patch"],
  ["view-image", "view_image"],
  ["imagegen", "imagegen"],
];
for (const [dir, name] of tools) {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  const binary = join(root, "src", "tools", dir, "bin", platformArch, exe);
  const stat = statSync(binary);
  if (!stat.isFile() || stat.size <= 0) throw new Error(`invalid binary: ${binary}`);
  if (process.platform !== "win32") accessSync(binary, constants.X_OK);
  console.log(`${name}: ${binary} (${stat.size} bytes)`);
}
