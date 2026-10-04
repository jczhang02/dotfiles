import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { On, RenderElement } from 'claude-code'

const SID = '11111111-1111-4111-8111-111111111111'
const USAGE = { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }

// `delays`: per call, in order; calls past the list wait `delayMs`.
// `messages`: the session's typed prompts; `isRenameRefused`: /rename run by
// the mod fails; `draft`: what the prompt box holds.
type World = {
  turns?: number
  replies?: string[]
  delayMs?: number
  delays?: number[]
  messages?: string[]
  isRenameRefused?: boolean
  draft?: string
}

// Stands in for the engine beneath the plugin; counts the naming calls.
function world(on: On, options: World = {}) {
  const clock = mock.clock(on)
  const calls: string[] = []
  const replies = [...(options.replies ?? ['Fix: resolve hook timeout on first prompt'])]
  const delays = [...(options.delays ?? [])]
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('fs.read', () => ({ value: 'Use English.' }))
  on('session.turns', () => ({ value: options.turns ?? 0 }))
  on('session.id', () => ({ value: SID }))
  on('ui.toast', () => ({ value: undefined }))
  // The engine draws nothing of its own in the band.
  on('ui.render', ($, e) => h($.ui.resolve(e).Box, null) as RenderElement)
  on('model.complete', async ($, e) => {
    calls.push(e.prompt)
    const delay = delays.shift() ?? options.delayMs
    if (delay) {
      await clock.sleep(delay)
    }
    return { value: { isAnswered: true, text: replies.shift() ?? 'fix: something else', usage: USAGE } }
  })
  on('classic.UserPromptSubmit', () => ({}))
  on('classic.SessionStart', () => ({}))
  const renamed: string[] = []
  const fills: string[] = []
  const submitted: { text: string; asUser?: true }[] = []
  on('prompt.submit', ($, e) => {
    submitted.push({ text: e.text, asUser: e.origin.kind === 'plugin' ? e.origin.asUser : undefined })
    return { text: e.text }
  })
  on('session.messages', () => ({
    value: (options.messages ?? []).map(text => ({ role: 'user' as const, text, toolUses: [] })),
  }))
  on('command.run', { command: 'rename' }, ($, e) => {
    if (options.isRenameRefused) {
      throw new Error('refused')
    }
    renamed.push(e.args)
    return { text: '' }
  })
  on('prompt.read', () => ({ value: { text: options.draft ?? '', cursor: 0 } }))
  on('prompt.fill', ($, e) => {
    fills.push(e.text)
    return { isFilled: true }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  return { clock, calls, renamed, fills, submitted }
}

const BAND = {
  plugin: 'session-title',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  viewport: { columns: 100, rows: 40 },
} as const

// Submits a prompt and lets the timers it starts run until the hook answers.
async function submit($: Engine, clock: MockClock, prompt: string, sessionTitle?: string, stepMs = 0) {
  const answer = $.classic.UserPromptSubmit({ session_id: SID, prompt, source: 'user', session_title: sessionTitle })
  for (let i = 0; i < 20; i++) {
    await clock.advance(stepMs)
  }
  return answer
}

test('names a new session from its first prompt, on that prompt', async ($, on) => {
  const { clock, calls } = world(on)
  const first = await submit($, clock, 'the hook times out on the first prompt, fix it')
  expect(first.sessionTitle).toBe('fix: resolve hook timeout on first prompt')
  expect(calls.length).toBe(1)

  const second = await submit($, clock, 'and add a test', 'fix: resolve hook timeout on first prompt')
  expect(second.sessionTitle).toBeUndefined()
  expect(calls.length).toBe(1)
})

test('a slow title shows from the next prompt', async ($, on) => {
  const { clock, calls } = world(on, { delayMs: 5000 })
  const first = await submit($, clock, 'compare two parsers', undefined, 100)
  expect(first.sessionTitle).toBeUndefined()
  await clock.advance(5000)

  const second = await submit($, clock, 'go on')
  expect(second.sessionTitle).toBe('fix: resolve hook timeout on first prompt')
  expect(calls.length).toBe(1)
})

test('leaves a session already named, a session under way, and a slash command alone', async ($, on) => {
  const { clock, calls } = world(on, { turns: 3 })
  expect((await submit($, clock, 'add dark mode', 'feat: my own title')).sessionTitle).toBeUndefined()
  expect((await submit($, clock, '/model haiku')).sessionTitle).toBeUndefined()
  expect(calls.length).toBe(0)
})

test('names the first typed prompt after a slash command', async ($, on) => {
  const { clock, calls } = world(on)
  await submit($, clock, '/model haiku')
  expect(calls.length).toBe(0)
  expect((await submit($, clock, 'fix the timeout')).sessionTitle).toBe('fix: resolve hook timeout on first prompt')
})

test('skips a resumed session', async ($, on) => {
  const { clock, calls } = world(on)
  await $.classic.SessionStart({ session_id: SID, source: 'resume' })
  expect((await submit($, clock, 'keep going')).sessionTitle).toBeUndefined()
  expect(calls.length).toBe(0)
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

test('rejects a reply outside the format, then names from the next prompt', async ($, on) => {
  const { clock, calls } = world(on, { replies: ['Here is a title: Parser work', 'research: compare two parsers'] })
  expect((await submit($, clock, 'compare two parsers')).sessionTitle).toBeUndefined()
  expect((await submit($, clock, 'start with speed')).sessionTitle).toBe('research: compare two parsers')
  expect(calls[1]).toContain('start with speed')
})

test('stops retrying after two failed namings', async ($, on) => {
  const { clock, calls } = world(on, { replies: ['nope', 'still nope', 'fix: too late'] })
  await submit($, clock, 'compare two parsers')
  await submit($, clock, 'go on')
  expect((await submit($, clock, 'and more')).sessionTitle).toBeUndefined()
  expect(calls.length).toBe(2)
})

test('takes the title line out of a reply with a lead-in', async ($, on) => {
  const { clock } = world(on, { replies: ['Here is a title:\n\n"fix: resolve hook timeout"'] })
  expect((await submit($, clock, 'fix the timeout')).sessionTitle).toBe('fix: resolve hook timeout')
})

test('/retitle <task> sends the task on, and that prompt carries the title', async ($, on) => {
  const { clock, calls, renamed, submitted } = world(on, {
    replies: ['fix: resolve hook timeout', 'feat: add dark mode to settings page'],
  })
  await submit($, clock, 'fix the timeout')
  const ran = await retitle($, clock, 'add dark mode to the settings page')
  expect(ran.text).toContain('feat: add dark mode to settings page')
  expect(calls[1]).toContain('add dark mode to the settings page')
  expect(submitted).toEqual([{ text: 'add dark mode to the settings page', asUser: true }])
  // The engine raises the handed-on prompt as a plugin's, not a typed one.
  const handed = await $.classic.UserPromptSubmit({
    session_id: SID,
    prompt: 'add dark mode to the settings page',
    source: 'system',
    session_title: 'fix: resolve hook timeout',
  })
  expect(handed.sessionTitle).toBe('feat: add dark mode to settings page')
  expect(renamed).toEqual([])
  expect((await submit($, clock, 'go', 'feat: add dark mode to settings page')).sessionTitle).toBeUndefined()
})

test('/retitle <task> too slow for its prompt shows the title when ready', async ($, on) => {
  const { clock, submitted } = world(on, { replies: ['feat: add dark mode'], delays: [20_000] })
  let text: string | undefined
  void retitle($, clock, 'add dark mode').then(r => (text = r.text))
  // /retitle gives up waiting after 8 s; the model answers after 20 s. /rename
  // then waits for the handed-on prompt's turn to end, which no test ends.
  for (let i = 0; i < 60; i++) {
    await clock.advance(500)
  }
  expect(text).toContain('Still naming')
  expect(submitted.map(p => p.text)).toEqual(['add dark mode'])
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^feat: add dark mode$/ })).toBeDefined()
})

test('/retitle falls back to the next prompt when /rename is refused', async ($, on) => {
  const { clock } = world(on, {
    replies: ['fix: resolve hook timeout', 'feat: add dark mode'],
    isRenameRefused: true,
    messages: ['add dark mode'],
  })
  await submit($, clock, 'fix the timeout')
  await retitle($, clock, '')
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /shows from your next prompt/ })).toBeDefined()
  expect((await submit($, clock, 'go', 'fix: resolve hook timeout')).sessionTitle).toBe('feat: add dark mode')
})

test('/retitle with no task names the session from its latest prompts', async ($, on) => {
  const { clock, calls, renamed } = world(on, {
    replies: ['chore: tidy dotfiles'],
    messages: ['fix the timeout', '<command-name>/model</command-name>', 'now tidy my dotfiles'],
  })
  expect((await retitle($, clock, '')).text).toContain('chore: tidy dotfiles')
  expect(calls[0]).toContain('now tidy my dotfiles')
  expect(calls[0]).not.toContain('command-name')
  expect(renamed).toEqual(['chore: tidy dotfiles'])
})

test('/retitle with a title in the format uses it as it is', async ($, on) => {
  const { clock, calls, renamed } = world(on)
  expect((await retitle($, clock, 'docs: write the readme')).text).toContain('docs: write the readme')
  expect(calls.length).toBe(0)
  expect(renamed).toEqual(['docs: write the readme'])
})

test('/retitle does not wait on a /rename that is still queued', async ($, on) => {
  const { clock } = world(on, { replies: ['feat: add dark mode'], messages: ['add dark mode'] })
  on('command.run', { command: 'rename' }, () => new Promise(() => {}))
  const ran = await retitle($, clock, '')
  expect(ran.text).toContain('feat: add dark mode')
})

test('Regenerate asks for a different title and applies it', async ($, on) => {
  const { clock, calls, renamed } = world(on, {
    replies: ['fix: resolve hook timeout on first prompt', 'fix: stop the first prompt hook timing out'],
    messages: ['the hook times out on the first prompt, fix it'],
  })
  await submit($, clock, 'the hook times out on the first prompt, fix it')
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'regenerate' })
  for (let i = 0; i < 20; i++) {
    await clock.advance(0)
  }
  expect(calls.length).toBe(2)
  expect(renamed).toEqual(['fix: stop the first prompt hook timing out'])
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /^fix: stop the first prompt hook timing out$/ })).toBeDefined()
})

test('Edit puts /rename and the title in the prompt box', async ($, on) => {
  const { clock, fills } = world(on)
  await submit($, clock, 'the hook times out on the first prompt, fix it')
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'edit' })
  expect(fills).toEqual(['/rename fix: resolve hook timeout on first prompt'])
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /resolve hook timeout/ })).toBeUndefined()
})

test('Edit keeps a draft in the prompt box and says so', async ($, on) => {
  const { clock, fills } = world(on, { draft: 'half a thought' })
  await submit($, clock, 'the hook times out on the first prompt, fix it')
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'edit' })
  expect(fills).toEqual([])
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /prompt box has text in it/ })).toBeDefined()
})

test('/retitle with no task and nothing typed yet shows its usage', async ($, on) => {
  world(on)
  const ran = await $.command.run({ command: 'retitle', args: '  ', origin: { kind: 'user' } } as never)
  expect(ran.text).toContain('Usage')
})

test('the band shows the title until the next prompt', async ($, on) => {
  const { clock } = world(on)
  await submit($, clock, 'the hook times out on the first prompt, fix it')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /^fix: resolve hook timeout on first prompt$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /next prompt/ })).toBeUndefined()
    await ui.unmount()
  }
  await submit($, clock, 'and add a test', 'fix: resolve hook timeout on first prompt')
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /resolve hook timeout/ })).toBeUndefined()
})

test('the band shows naming, then a late title for one more prompt', async ($, on) => {
  const { clock } = world(on, { delayMs: 5000 })
  await submit($, clock, 'compare two parsers', undefined, 100)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Naming this session/ })).toBeDefined()
  await clock.advance(5000)
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /shows from your next prompt/ })).toBeDefined()

  await submit($, clock, 'go on')
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /resolve hook timeout/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /next prompt/ })).toBeUndefined()

  await submit($, clock, 'and more', 'fix: resolve hook timeout on first prompt')
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /resolve hook timeout/ })).toBeUndefined()
})

test('the band shows a failure until dismissed', async ($, on) => {
  const { clock } = world(on, { replies: ['Here is a title: Parser work'] })
  await submit($, clock, 'compare two parsers')
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Couldn.t name this session \(invalid-title\)/ })).toBeDefined()
  await ui.press({ key: 'dismiss' })
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /name this session/ })).toBeUndefined()
})

function retitle($: Engine, clock: MockClock, args: string) {
  const ran = $.command.run({
    command: 'retitle',
    args,
    origin: { kind: 'user' },
    presentation: { isFullscreen: false, columns: 120 },
  } as never)
  return (async () => {
    for (let i = 0; i < 20; i++) {
      await clock.advance(0)
    }
    return ran
  })()
}

test('/retitle applies before the mod has seen a prompt', async ($, on) => {
  // As after a reload mid-session: the session already has a title the mod never saw.
  // /rename refused, so the next prompt has to carry it past the rename check.
  const { clock } = world(on, { replies: ['chore: clean up dotfiles'], isRenameRefused: true })
  expect((await retitle($, clock, 'make dotfiles clean')).text).toContain('chore: clean up dotfiles')
  const next = await submit($, clock, 'go', 'feat: an older title')
  expect(next.sessionTitle).toBe('chore: clean up dotfiles')
})

test('/retitle wins over a /rename made before it', async ($, on) => {
  const { clock } = world(on, { replies: ['fix: resolve hook timeout', 'chore: clean up dotfiles'], isRenameRefused: true })
  await submit($, clock, 'fix the timeout')
  await retitle($, clock, 'make dotfiles clean')
  const next = await submit($, clock, 'go', 'docs: my own rename')
  expect(next.sessionTitle).toBe('chore: clean up dotfiles')
})

test('a naming cut off by a reload names from the next prompt', async ($, on) => {
  const { clock, calls } = world(on, { delays: [600_000] })
  expect((await submit($, clock, 'compare two parsers', undefined, 100)).sessionTitle).toBeUndefined()
  // The reload: session.start fires again while the first call still hangs.
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Naming this session/ })).toBeUndefined()
  const next = await submit($, clock, 'go on')
  expect(next.sessionTitle).toBe('fix: resolve hook timeout on first prompt')
  expect(calls.length).toBe(2)
})

test('a naming that hangs past the model timeout names from the next prompt', async ($, on) => {
  const { clock, calls } = world(on, { delays: [600_000] })
  expect((await submit($, clock, 'compare two parsers', undefined, 100)).sessionTitle).toBeUndefined()
  await clock.advance(100_000)
  const next = await submit($, clock, 'go on')
  expect(next.sessionTitle).toBe('fix: resolve hook timeout on first prompt')
  expect(calls.length).toBe(2)
  // The hung call settling later changes nothing.
  await clock.advance(600_000)
  expect((await submit($, clock, 'more', 'fix: resolve hook timeout on first prompt')).sessionTitle).toBeUndefined()
})
