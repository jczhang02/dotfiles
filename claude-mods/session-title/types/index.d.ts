export type NamingOutcome = 'pending' | 'named' | 'applied' | 'skipped' | 'skip_renamed' | 'failed'

export type Naming = {
  outcome: NamingOutcome
  // Tells a newer naming apart from an older one still running; it is also
  // when the naming started, on the clock.
  token: number
  title?: string
  // The session title when naming started; a different one later means /rename ran.
  previous?: string
  // From /retitle: applied whatever the title is by then.
  isForced?: boolean
  // The task /retitle sent on as a prompt; that prompt carries the title.
  handoff?: string
  // Automatic namings tried so far in this conversation.
  attempts?: number
  reason?: string
}

// What the band above the prompt shows.
export type Notice =
  | { kind: 'naming' }
  // `late`: the title came after its prompt and shows from the next one.
  // `isApplying`: asked for with /retitle or a button, /rename on its way.
  | { kind: 'named'; title: string; late: boolean; isApplying?: boolean; hint?: string }
  | { kind: 'failed'; reason: string; hint?: string }

declare module 'claude-code' {
  interface PluginState {
    'session-title': {
      naming: Record<string, Naming>
      // The title /clear carried into a fresh conversation, per session.
      cleared: Record<string, string | null>
      notice: Notice | null
    }
  }
}
