export type NamingOutcome = 'pending' | 'named' | 'applied' | 'skipped' | 'skip_renamed' | 'failed'

export type Naming = {
  outcome: NamingOutcome
  // Tells a newer naming (from /retitle) apart from an older one still running.
  token: number
  title?: string
  // The session title when naming started; a different one later means /rename ran.
  previous?: string
  reason?: string
}

declare module 'claude-code' {
  interface PluginState {
    'session-title': {
      naming: Record<string, Naming>
      // The session title the engine last reported, per session.
      seen: Record<string, string | null>
    }
  }
}
