import { describe, expect, mock, test } from "bun:test";

mock.module("@earendil-works/pi-tui", () => ({
  visibleWidth: (value: string) => [...value.replace(/\x1b\[[0-9;]*m/g, "")].length,
  truncateToWidth: (value: string, width: number) => [...value].slice(0, width).join(""),
}));

const { WelcomeHeader } = await import("../welcome.ts");

describe("welcome", () => {
  test("quiet startup header keeps original rich welcome layout", () => {
    const header = new WelcomeHeader(
      "gpt-test",
      "provider-test",
      [{ name: "project", timeAgo: "1h ago" }],
      { contextFiles: 2, extensions: 3, skills: 4, promptTemplates: 5 },
    );

    const rendered = header.render(96).join("\n");
    expect(rendered).toContain("Welcome back!");
    expect(rendered).toContain("Tips");
    expect(rendered).toContain("Loaded");
    expect(rendered).toContain("Recent sessions");
    expect(rendered).toContain("gpt-test");
    expect(rendered).toContain("project");
  });

  test("overlay copy says welcome stays visible", async () => {
    const { WelcomeComponent } = await import("../welcome.ts");
    const overlay = new WelcomeComponent("gpt-test", "provider-test");
    expect(overlay.render(96).join("\n")).toContain("Welcome stays visible");
  });
});
