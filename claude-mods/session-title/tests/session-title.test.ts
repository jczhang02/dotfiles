import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { On } from 'claude-code'

const SID = '11111111-1111-4111-8111-111111111111'
const USAGE = { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
const TITLE = 'fix: resolve hook timeout on first prompt'

// `delays`: per call, in order; calls past the list wait `delayMs`.
// `messages`: the session's typed prompts; `stored`: what the mod's store
// holds when the test starts.
type World = {
  turns?: number
  replies?: string[]
  delayMs?: number
  delays?: number[]
  messages?: string[]
  stored?: Record<string, string>
}

// Stands in for the engine beneath the plugin; records the naming calls,
// their prompts in `calls` and their system prompts in `systems`.
function world(on: On, options: World = {}) {
  const clock = mock.clock(on)
  const calls: string[] = []
  const systems: string[] = []
  const replies = [...(options.replies ?? [TITLE])]
  const delays = [...(options.delays ?? [])]
  const store = new Map(Object.entries(options.stored ?? {}))
  on('fs.read', () => ({ value: 'Use English.' }))
  on('session.turns', () => ({ value: options.turns ?? 0 }))
  on('session.id', () => ({ value: SID }))
  on('session.cwd', () => ({ value: '/home/jc/dev/dotfiles' }))
  on('session.messages', () => ({
    value: (options.messages ?? []).map(text => ({ role: 'user' as const, text, toolUses: [] })),
  }))
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => (store.set(e.key, e.value as string), { value: undefined }))
  on('store.delete', ($, e) => (store.delete(e.key), { value: undefined }))
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('model.complete', async ($, e) => {
    calls.push(e.prompt)
    systems.push(e.system ?? '')
    const delay = delays.shift() ?? options.delayMs
    if (delay) {
      await clock.sleep(delay)
    }
    return { value: { isAnswered: true, text: replies.shift() ?? 'fix: something else', usage: USAGE } }
  })
  on('classic.UserPromptSubmit', () => ({}))
  on('classic.SessionStart', () => ({}))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  return { clock, calls, systems, store }
}

// Lets the timers the plugin started run.
async function settle(clock: MockClock, stepMs = 0) {
  for (let i = 0; i < 20; i++) {
    await clock.advance(stepMs)
  }
}

// Submits a typed prompt and lets the timers it starts run until the hook answers.
async function submit($: Engine, clock: MockClock, prompt: string, sessionTitle?: string, stepMs = 0) {
  const answer = $.classic.UserPromptSubmit({ session_id: SID, prompt, source: 'user', session_title: sessionTitle })
  await settle(clock, stepMs)
  return answer
}

// Ends a turn of the main loop (or of `agentId`'s) and lets its naming run.
async function turn($: Engine, clock: MockClock, answer = 'Done.', reason = 'answer', agentId?: string) {
  await $.turn.complete({
    answer,
    durationMs: 1000,
    isAborted: reason === 'aborted',
    turnId: 'turn',
    reason,
    ...(agentId ? { agentId } : {}),
  } as never)
  await settle(clock)
}

test('names a new session from its first prompt, on that prompt', async ($, on) => {
  const { clock, calls, store } = world(on)
  const first = await submit($, clock, 'the hook times out on the first prompt, fix it')
  expect(first.sessionTitle).toBe(TITLE)
  expect(calls.length).toBe(1)
  expect(store.get(SID)).toBe(TITLE)

  const second = await submit($, clock, 'and add a test', TITLE)
  expect(second.sessionTitle).toBeUndefined()
  expect(calls.length).toBe(1)
})

test('a slow title shows from the next prompt', async ($, on) => {
  const { clock, calls } = world(on, { delayMs: 5000 })
  const first = await submit($, clock, 'compare two parsers', undefined, 100)
  expect(first.sessionTitle).toBeUndefined()
  await clock.advance(5000)

  const second = await submit($, clock, 'go on')
  expect(second.sessionTitle).toBe(TITLE)
  expect(calls.length).toBe(1)
})

test('leaves a session already named, a session under way, and a slash command alone', async ($, on) => {
  const { clock, calls } = world(on, { turns: 3 })
  expect((await submit($, clock, 'add dark mode', 'feat: my own title')).sessionTitle).toBeUndefined()
  expect((await submit($, clock, '/model haiku')).sessionTitle).toBeUndefined()
  await turn($, clock)
  expect(calls.length).toBe(0)
})

test('names the first typed prompt after a slash command', async ($, on) => {
  const { clock, calls } = world(on)
  await submit($, clock, '/model haiku')
  expect(calls.length).toBe(0)
  expect((await submit($, clock, 'fix the timeout')).sessionTitle).toBe(TITLE)
})

test('takes the title line out of a reply with a lead-in', async ($, on) => {
  const { clock } = world(on, { replies: ['Here is a title:\n\n"fix: resolve hook timeout"'] })
  expect((await submit($, clock, 'fix the timeout')).sessionTitle).toBe('fix: resolve hook timeout')
})

test('names the session again from its first answered turn', async ($, on) => {
  const { clock, calls, systems } = world(on, {
    replies: ['fix: debug script execution issue', 'fix: restore exec permission on ghostty-notify.sh'],
    messages: ['this script does not run'],
  })
  expect((await submit($, clock, 'this script does not run')).sessionTitle).toBe('fix: debug script execution issue')
  await turn($, clock, 'ghostty-notify.sh lost its exec bit; I ran chmod +x on it.')
  expect(calls.length).toBe(2)
  expect(calls[1]).toContain('this script does not run')
  expect(calls[1]).toContain('ghostty-notify.sh lost its exec bit')
  expect(calls[1]).toContain('Working directory: dotfiles')
  expect(systems[1]).not.toContain('keep')

  const next = await submit($, clock, 'now commit it', 'fix: debug script execution issue')
  expect(next.sessionTitle).toBe('fix: restore exec permission on ghostty-notify.sh')
})

test('an interrupted turn or a subagent turn names nothing', async ($, on) => {
  const { clock, calls } = world(on, { messages: ['fix the timeout'] })
  await submit($, clock, 'fix the timeout')
  await turn($, clock, '', 'aborted')
  await turn($, clock, 'Report.', 'answer', 'agent-1')
  expect(calls.length).toBe(1)
  await turn($, clock)
  expect(calls.length).toBe(2)
})

test('a failed first title is made up for by the first answered turn', async ($, on) => {
  const { clock, calls } = world(on, {
    replies: ['Here is a title: Parser work', 'research: compare two parsers'],
    messages: ['compare two parsers'],
  })
  expect((await submit($, clock, 'compare two parsers')).sessionTitle).toBeUndefined()
  await turn($, clock)
  expect((await submit($, clock, 'start with speed')).sessionTitle).toBe('research: compare two parsers')
  expect(calls.length).toBe(2)
})

test('checks the title every checkTurns answered turns and keeps it while the task holds', async ($, on) => {
  const { clock, calls, systems } = world(on, {
    replies: [TITLE, TITLE, 'keep'],
    messages: ['fix the timeout', 'add a test for it'],
  })
  await submit($, clock, 'fix the timeout')
  await turn($, clock)
  expect(calls.length).toBe(2)
  for (let i = 0; i < 7; i++) {
    await turn($, clock)
  }
  expect(calls.length).toBe(2)
  await turn($, clock)
  expect(calls.length).toBe(3)
  expect(systems[2]).toContain(`The session is named "${TITLE}"`)
  expect(calls[2]).toContain('add a test for it')
  expect((await submit($, clock, 'go on', TITLE)).sessionTitle).toBeUndefined()
})

test('a check renames the session when the main task changed', async ($, on) => {
  const { clock, calls } = world(on, {
    replies: [TITLE, TITLE, 'chore: configure tmux pane borders'],
    messages: ['fix the timeout', 'now set up my tmux pane borders'],
  })
  await submit($, clock, 'fix the timeout')
  for (let i = 0; i < 9; i++) {
    await turn($, clock)
  }
  expect(calls.length).toBe(3)
  expect((await submit($, clock, 'go on', TITLE)).sessionTitle).toBe('chore: configure tmux pane borders')
})

test('a /rename stops automatic naming until /clear', async ($, on) => {
  const options: World = { messages: ['fix the timeout'], replies: [TITLE, 'fix: refined', 'research: explain hard links'] }
  const { clock, calls } = world(on, options)
  await submit($, clock, 'fix the timeout')
  await turn($, clock)
  expect(calls.length).toBe(2)
  // The person renamed the session before the refined title went out.
  expect((await submit($, clock, 'go on', 'docs: my own title')).sessionTitle).toBeUndefined()
  for (let i = 0; i < 20; i++) {
    await turn($, clock)
  }
  expect(calls.length).toBe(2)

  options.turns = 4
  await $.classic.SessionStart({ session_id: SID, source: 'clear', session_title: 'docs: my own title' })
  const after = await submit($, clock, 'what is a hard link', 'docs: my own title')
  expect(after.sessionTitle).toBe('research: explain hard links')
})

test('names the session again after /clear', async ($, on) => {
  const options: World = { replies: ['research: explain inodes', 'research: explain hard links'] }
  const { clock, calls } = world(on, options)
  await submit($, clock, 'what is an inode')
  options.turns = 4
  await $.classic.SessionStart({ session_id: SID, source: 'clear', session_title: 'research: explain inodes' })
  const after = await submit($, clock, 'what is a hard link', 'research: explain inodes')
  expect(after.sessionTitle).toBe('research: explain hard links')
  expect(calls.length).toBe(2)
})

test('keeps a /rename made after /clear', async ($, on) => {
  const { clock, calls } = world(on)
  await $.classic.SessionStart({ session_id: SID, source: 'clear', session_title: 'research: explain inodes' })
  expect((await submit($, clock, 'what is a hard link', 'docs: my own title')).sessionTitle).toBeUndefined()
  expect(calls.length).toBe(0)
})

test('drops a late title when /rename ran meanwhile', async ($, on) => {
  const { clock } = world(on, { delayMs: 5000 })
  await submit($, clock, 'compare two parsers', undefined, 100)
  await clock.advance(5000)
  expect((await submit($, clock, 'go on', 'research: my rename')).sessionTitle).toBeUndefined()
})

test('a title that came back with a suffix still counts as the mod\'s', async ($, on) => {
  const { clock } = world(on, { replies: [TITLE, 'fix: refined title'], messages: ['fix the timeout'] })
  await submit($, clock, 'fix the timeout')
  await turn($, clock)
  expect((await submit($, clock, 'go on', `${TITLE} 2`)).sessionTitle).toBe('fix: refined title')
})

test('skips a resumed session the mod did not name', async ($, on) => {
  const { clock, calls } = world(on, { messages: ['keep going'] })
  await $.classic.SessionStart({ session_id: SID, source: 'resume', session_title: 'docs: my own title' })
  expect((await submit($, clock, 'keep going', 'docs: my own title')).sessionTitle).toBeUndefined()
  for (let i = 0; i < 10; i++) {
    await turn($, clock)
  }
  expect(calls.length).toBe(0)
})

test('goes on watching a resumed session the mod named', async ($, on) => {
  const { clock, calls, systems } = world(on, {
    stored: { [SID]: TITLE },
    replies: ['chore: configure tmux pane borders'],
    messages: ['now set up my tmux pane borders'],
  })
  await $.classic.SessionStart({ session_id: SID, source: 'resume', session_title: TITLE })
  expect((await submit($, clock, 'now set up my tmux pane borders', TITLE)).sessionTitle).toBeUndefined()
  for (let i = 0; i < 8; i++) {
    await turn($, clock)
  }
  expect(calls.length).toBe(1)
  expect(systems[0]).toContain(`The session is named "${TITLE}"`)
  expect((await submit($, clock, 'go on', TITLE)).sessionTitle).toBe('chore: configure tmux pane borders')
})

test('a naming cut off by a reload is made up for by the next answered turn', async ($, on) => {
  const { clock, calls } = world(on, { delays: [600_000], messages: ['compare two parsers'] })
  expect((await submit($, clock, 'compare two parsers', undefined, 100)).sessionTitle).toBeUndefined()
  // The reload: session.start fires again while the first call still hangs.
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await turn($, clock)
  expect(calls.length).toBe(2)
  expect((await submit($, clock, 'go on')).sessionTitle).toBe(TITLE)
  // The hung call settling later changes nothing.
  await clock.advance(600_000)
  expect((await submit($, clock, 'more', TITLE)).sessionTitle).toBeUndefined()
})

test('a turn while a call hangs waits, then names once the call is stale', async ($, on) => {
  const { clock, calls } = world(on, { delays: [600_000], messages: ['compare two parsers'] })
  await submit($, clock, 'compare two parsers', undefined, 100)
  await turn($, clock)
  expect(calls.length).toBe(1)
  await clock.advance(100_000)
  await turn($, clock)
  expect(calls.length).toBe(2)
  expect((await submit($, clock, 'go on')).sessionTitle).toBe(TITLE)
})

test('after /clear the refinement names from the new first prompt alone', async ($, on) => {
  const options: World = {
    replies: ['research: explain inodes', 'research: explain hard links', 'research: explain hard link counts'],
    messages: ['what is an inode'],
  }
  const { clock, calls } = world(on, options)
  await submit($, clock, 'what is an inode')
  options.turns = 4
  await $.classic.SessionStart({ session_id: SID, source: 'clear', session_title: 'research: explain inodes' })
  // The transcript may still list the prompts from before /clear.
  options.messages = ['what is an inode', 'what is a hard link']
  await submit($, clock, 'what is a hard link', 'research: explain inodes')
  await turn($, clock)
  expect(calls.length).toBe(3)
  expect(calls[2]).toContain('what is a hard link')
  expect(calls[2]).not.toContain('inode')
})
