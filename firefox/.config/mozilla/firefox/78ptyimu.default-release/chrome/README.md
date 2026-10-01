# Firefox UI setup

Tree Style Tab in the sidebar, native tabs and sidebar clutter hidden. Flat, light/dark aware.

These files are symlinks from the `firefox` package in `~/dev/dotfiles`. Edit them there.

| File | Loaded by | What it does |
|---|---|---|
| `userChrome.css` | Firefox, at startup | Hides native tabs, the sidebar icon strip, and the sidebar title bar |
| `vendor/hide_tabs_toolbar_v2.css` | `userChrome.css` | Upstream snippet from MrOtherGuy/firefox-csshacks (MPL 2.0) |
| `vendor/autohide_sidebar.css` | `userChrome.css` | Upstream snippet: sidebar collapses to a strip, expands on hover |
| `userContent.css` | Firefox, at startup | Paints TST's sidebar page background early (no flash in new windows) |
| `tst.css` | Nothing (copy by hand) | Tab tree style. Paste into TST options > Advanced > Extra style rules |
| `startpage/` | Firefox, as the homepage | Start page (tree of links, search, clock). Settings: gear icon or `,` |
| `../user.js` | Firefox, every startup | Turns on `toolkit.legacyUserProfileCustomizations.stylesheets`, sets the homepage to `startpage/index.html` |

## One-time steps

1. Restart Firefox.
2. Install Tree Style Tab: https://addons.mozilla.org/firefox/addon/tree-style-tab/
3. Open its sidebar (F1, or the TST toolbar button).
4. TST options > Appearance > Theme: choose "Nova" (matches Firefox 157). `tst.css` sits on top of it.
5. TST options > Advanced: paste `tst.css` into "Extra style rules for contents provided by Tree Style Tab".

## Tweaking

- Firefox UI: edit `userChrome.css`, restart Firefox. Find selectors with the Browser Toolbox (Ctrl+Alt+Shift+I after enabling `devtools.chrome.enabled` and `devtools.debugger.remote-enabled`).
- Tab tree: edit `tst.css`, paste again. Inspect the TST sidebar via about:debugging > This Firefox > Tree Style Tab > Inspect.
- Denser toolbars: set `browser.uidensity` to 1 in about:config.
- Update the vendor snippet: https://github.com/MrOtherGuy/firefox-csshacks/blob/master/chrome/hide_tabs_toolbar_v2.css
- Start page: theme, accent, clock, search engine and links are edited in its settings panel and saved in the browser. The defaults live at the top of `startpage/app.js`; colors at the top of `startpage/style.css`.
