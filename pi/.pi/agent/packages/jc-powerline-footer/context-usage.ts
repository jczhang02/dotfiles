interface CoreContextUsage {
  contextTokens: number | null;
  contextWindow: number | null;
  contextPercent: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readCoreContextUsage(ctx: unknown): CoreContextUsage | null {
  if (!isRecord(ctx) || typeof ctx.getContextUsage !== "function") {
    return null;
  }

  const usage = ctx.getContextUsage();
  if (!isRecord(usage)) {
    return { contextTokens: null, contextWindow: null, contextPercent: null };
  }

  const tokens = usage.tokens;
  const contextWindow = usage.contextWindow;
  const validWindow = typeof contextWindow === "number" && Number.isFinite(contextWindow) && contextWindow > 0;
  const validTokens = typeof tokens === "number" && Number.isFinite(tokens);

  if (!validTokens || !validWindow) {
    return {
      contextTokens: validTokens ? tokens : null,
      contextWindow: validWindow ? contextWindow : null,
      contextPercent: null,
    };
  }

  const reportedPercent = usage.percent;
  const contextPercent = typeof reportedPercent === "number" && Number.isFinite(reportedPercent)
    ? reportedPercent
    : (tokens / contextWindow) * 100;

  return {
    contextTokens: tokens,
    contextWindow,
    contextPercent,
  };
}
