export type Naming = {
  // Set once the person names the session (/rename, --name), or when the mod
  // leaves it alone; no automatic naming then until /clear.
  off?: 'renamed' | 'skipped'
  // `refine`: the next answered turn names the session from what it is
  // about; `watch`: every few turns a check keeps the title unless the main
  // task changed.
  phase: 'refine' | 'watch'
  // The title this mod last gave the session (or the one /clear carried
  // over); a different session title means the person renamed it.
  owned?: string
  // A title waiting for the next typed prompt to carry it.
  ready?: string
  // The model call under way, by when it started on the clock.
  token?: number
  // Answered turns since the last naming or check.
  turns: number
  // Failed refinements so far.
  tries: number
  // The first typed prompt, clipped, until the refinement is done.
  opening?: string
}

declare module 'claude-code' {
  interface PluginState {
    'session-title': {
      naming: Shaped<Record<string, Naming>>
      // The title /clear carried into a fresh conversation, per session.
      cleared: Record<string, string | null>
    }
  }
}
