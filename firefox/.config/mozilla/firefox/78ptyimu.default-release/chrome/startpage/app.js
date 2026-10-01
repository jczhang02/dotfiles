// Defaults. Everything here can be changed in the settings panel (press ",");
// changes are saved in the browser, so this file only matters on first run
// or after "Reset everything".
const DEFAULT_LINKS = `general
  github       https://github.com/                  g
  gmail        https://mail.google.com/             m
  calendar     https://calendar.google.com/         c

reddit
  front page   https://www.reddit.com/              r
  unixporn     https://www.reddit.com/r/unixporn/

docs
  arch wiki    https://wiki.archlinux.org/          a
  gentoo wiki  https://wiki.gentoo.org/             w
  mdn          https://developer.mozilla.org/

media
  youtube      https://www.youtube.com/             y
  netflix      https://www.netflix.com/             n
  hulu         https://www.hulu.com/
`;

const ENGINES = {
  duckduckgo: ["DuckDuckGo", "https://duckduckgo.com/?q="],
  google: ["Google", "https://www.google.com/search?q="],
  bing: ["Bing", "https://www.bing.com/search?q="],
  brave: ["Brave", "https://search.brave.com/search?q="],
  kagi: ["Kagi", "https://kagi.com/search?q="],
  startpage: ["Startpage", "https://www.startpage.com/do/search?q="],
};

const DEFAULTS = {
  theme: "auto",      // auto | light | dark
  accent: "indigo",   // indigo | teal | green | amber | rose | mono
  clock: "24",        // 24 | 12 | off
  engine: "duckduckgo",
  customUrl: "",      // used when engine is "custom"; the query is appended
  autofocus: false,   // off: letter keys open links right away
  links: DEFAULT_LINKS,
};

const STORE_KEY = "startpage";
const THEMES = ["auto", "light", "dark"];
const RESERVED_KEYS = ["/", ",", "."];

// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const input = $("q");
const dialog = $("settings");
const form = $("settings-form");
const fields = form.elements;

let state = load();
let linkKeys = new Map();
let clockTimer;
let toastTimer;

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY)) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {}
}

// "example.com", "localhost:8080", "https://..." are addresses, not searches.
function asUrl(text) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) || /^(about|mailto):/i.test(text)) return text;
  if (/\s/.test(text)) return null;
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/i.test(text)) return "http://" + text;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(text)) return "https://" + text;
  return null;
}

// ---- shortcuts ------------------------------------------------------------

function parseLinks(text) {
  const trees = [];
  const errors = [];
  const keys = new Set();
  let folder = null;

  text.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line.trim() || line.trim().startsWith("#")) return;
    const where = `line ${i + 1}`;

    if (!/^\s/.test(line)) {
      folder = { name: line.replace(/\/$/, ""), links: [] };
      trees.push(folder);
      return;
    }
    if (!folder) {
      errors.push(`${where}: indented link before any folder`);
      return;
    }

    const parts = line.trim().split(/\s+/);
    let key = null;
    if (parts.length >= 2 && parts.at(-1).length === 1 && asUrl(parts.at(-2))) {
      key = parts.pop().toLowerCase();
    }
    const url = asUrl(parts.pop());
    if (!url) {
      errors.push(`${where}: no url at the end`);
      return;
    }
    const label = parts.join(" ") || new URL(url).hostname;

    if (key && RESERVED_KEYS.includes(key)) {
      errors.push(`${where}: "${key}" is a built-in key`);
      key = null;
    } else if (key && keys.has(key)) {
      errors.push(`${where}: key "${key}" is used twice`);
      key = null;
    }
    if (key) keys.add(key);
    folder.links.push({ label, url, key });
  });

  return { trees, errors };
}

function renderTrees() {
  const { trees, errors } = parseLinks(state.links);
  const nav = $("trees");
  nav.replaceChildren();
  linkKeys = new Map();

  for (const tree of trees) {
    const section = document.createElement("section");
    section.className = "tree";

    const title = document.createElement("h2");
    title.textContent = tree.name;

    const list = document.createElement("ul");
    for (const { label, url, key } of tree.links) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = url;
      link.textContent = label;
      if (key) {
        const hint = document.createElement("kbd");
        hint.textContent = key;
        link.append(hint);
        linkKeys.set(key, url);
      }
      item.append(link);
      list.append(item);
    }

    section.append(title, list);
    nav.append(section);
  }

  const status = $("links-status");
  const count = trees.reduce((n, t) => n + t.links.length, 0);
  status.textContent = errors.length
    ? errors.join("\n")
    : `${trees.length} folders, ${count} links`;
  status.classList.toggle("error", errors.length > 0);
}

// ---- appearance -----------------------------------------------------------

function applyTheme() {
  if (state.theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = state.theme;
  root.dataset.accent = state.accent;
}

function tickClock() {
  clearTimeout(clockTimer);
  $("top").hidden = state.clock === "off";
  const now = new Date();
  $("clock").textContent = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: state.clock === "12",
  });
  $("date").textContent = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  // Wake up again right at the next minute.
  clockTimer = setTimeout(tickClock, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()));
}

function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1200);
}

// ---- search ---------------------------------------------------------------

function searchUrl() {
  if (state.engine === "custom" && state.customUrl.trim()) return state.customUrl.trim();
  return (ENGINES[state.engine] ?? ENGINES.duckduckgo)[1];
}

function applySearch() {
  const engine = ENGINES[state.engine];
  input.placeholder = engine ? `search ${engine[0].toLowerCase()} or type a url` : "search or type a url";
}

$("search").addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  location.href = asUrl(text) ?? searchUrl() + encodeURIComponent(text);
});

// ---- settings -------------------------------------------------------------

for (const [id, [name]] of Object.entries(ENGINES)) {
  fields.engine.add(new Option(name, id));
}
fields.engine.add(new Option("Custom...", "custom"));

function fillSettings() {
  for (const name of ["theme", "accent", "clock", "engine", "customUrl", "links"]) {
    fields[name].value = state[name];
  }
  fields.autofocus.checked = state.autofocus;
  fields.customUrl.hidden = state.engine !== "custom";
}

function openSettings() {
  fillSettings();
  dialog.showModal();
}

form.addEventListener("input", (event) => {
  const field = event.target;
  if (!(field.name in state)) return;
  state[field.name] = field.type === "checkbox" ? field.checked : field.value;
  save();

  if (field.name === "theme" || field.name === "accent") applyTheme();
  if (field.name === "clock") tickClock();
  if (field.name === "engine") {
    fields.customUrl.hidden = state.engine !== "custom";
    applySearch();
  }
  if (field.name === "links") renderTrees();
});

// Tab indents inside the shortcuts editor.
fields.links.addEventListener("keydown", (event) => {
  if (event.key !== "Tab" || event.shiftKey) return;
  event.preventDefault();
  fields.links.setRangeText("  ", fields.links.selectionStart, fields.links.selectionEnd, "end");
  fields.links.dispatchEvent(new Event("input", { bubbles: true }));
});

$("open-settings").addEventListener("click", openSettings);

// Click on the dimmed backdrop closes the panel.
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

$("reset").addEventListener("click", () => {
  if (!confirm("Reset theme, search and shortcuts to the defaults?")) return;
  state = { ...DEFAULTS };
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {}
  applyAll();
  fillSettings();
});

// ---- keyboard -------------------------------------------------------------

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (dialog.open) return; // the dialog closes itself on Esc

  if (event.target === input) {
    if (event.key === "Escape") {
      input.value = "";
      input.blur();
    }
    return;
  }
  if (event.target.closest?.("input, textarea, select")) return;

  if (event.key === "/") {
    event.preventDefault();
    input.focus();
  } else if (event.key === ",") {
    event.preventDefault();
    openSettings();
  } else if (event.key === ".") {
    state.theme = THEMES[(THEMES.indexOf(state.theme) + 1) % THEMES.length];
    save();
    applyTheme();
    toast(`theme: ${state.theme}`);
  } else {
    const url = linkKeys.get(event.key.toLowerCase());
    if (!url) return;
    event.preventDefault();
    if (event.shiftKey) window.open(url, "_blank");
    else location.href = url;
  }
});

// ---------------------------------------------------------------------------

function applyAll() {
  applyTheme();
  tickClock();
  applySearch();
  renderTrees();
}

applyAll();
if (state.autofocus) input.focus();
