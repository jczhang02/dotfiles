import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { On, RenderElement } from 'claude-code'

const SID = '11111111-1111-4111-8111-111111111111'
const USAGE = { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }

// `delays`: per call, in order; calls past the list wait `delayMs`.
type World = { turns?: number; replies?: string[]; delayMs?: number; delays?: number[] }

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
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  return { clock, calls }
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

test('/retitle names the session again from the next prompt', async ($, on) => {
  const { clock, calls } = world(on, { replies: ['fix: resolve hook timeout', 'feat: add dark mode to settings page'] })
  await submit($, clock, 'fix the timeout')
  const ran = $.command.run({
    command: 'retitle',
    args: 'add dark mode to the settings page',
    origin: { kind: 'user' },
    presentation: { isFullscreen: false, columns: 120 },
  } as never)
  for (let i = 0; i < 20; i++) {
    await clock.advance(0)
  }
  expect((await ran).text).toContain('feat: add dark mode to settings page')
  expect(calls[1]).toContain('add dark mode to the settings page')

  const next = await submit($, clock, 'start with the toggle', 'fix: resolve hook timeout')
  expect(next.sessionTitle).toBe('feat: add dark mode to settings page')
})

test('/retitle without a task shows its usage', async ($, on) => {
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
  const { clock } = world(on, { replies: ['chore: clean up dotfiles'] })
  expect((await retitle($, clock, 'make dotfiles clean')).text).toContain('chore: clean up dotfiles')
  const next = await submit($, clock, 'go', 'feat: an older title')
  expect(next.sessionTitle).toBe('chore: clean up dotfiles')
})

test('/retitle wins over a /rename made before it', async ($, on) => {
  const { clock } = world(on, { replies: ['fix: resolve hook timeout', 'chore: clean up dotfiles'] })
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
