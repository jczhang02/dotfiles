# Firefox UI setup

Tree Style Tab in the sidebar, native tabs and sidebar clutter hidden. Flat, light/dark aware.

These files are symlinks from the `firefox` package in `~/dev/dotfiles`. Edit them there.

| File | Loaded by | What it does |
|---|---|---|
| `userChrome.css` | Firefox, at startup | Hides native tabs, the sidebar icon strip, and the sidebar title bar |
| `vendor/hide_tabs_toolbar_v2.css` | `userChrome.css` | Upstream snippet from MrOtherGuy/firefox-csshacks (MPL 2.0) |
| `vendor/autohide_sidebar.css` | `userChrome.css` | Upstream snippet: sidebar collapses to a strip, expands on hover |
| `userContent.css` | Firefox, at startup | Paints TST's sidebar page background early (no flash in new windows) |
| `tst.css` | TST, via `tst-css-install` | Tab tree style, written into TST's "Extra style rules" |
| `../user.js` | Firefox, every startup | Turns on `toolkit.legacyUserProfileCustomizations.stylesheets` |

## One-time steps

1. Restart Firefox.
2. Install Tree Style Tab: https://addons.mozilla.org/firefox/addon/tree-style-tab/
3. Open its sidebar (F1, or the TST toolbar button).
4. TST options > Appearance > Theme: choose "Nova" (matches Firefox 157). `tst.css` sits on top of it.
5. Quit Firefox and run `tst-css-install` (from this package's `.local/bin`). It writes `tst.css` into TST's "Extra style rules"; pasting it into TST options > Advanced does the same.

## Tweaking

- Firefox UI: edit `userChrome.css`, restart Firefox. Find selectors with the Browser Toolbox (Ctrl+Alt+Shift+I after enabling `devtools.chrome.enabled` and `devtools.debugger.remote-enabled`).
- Tab tree: edit `tst.css`, quit Firefox, run `tst-css-install`, start Firefox. Inspect the TST sidebar via about:debugging > This Firefox > Tree Style Tab > Inspect.
- Denser toolbars: set `browser.uidensity` to 1 in about:config.
- Update the vendor snippet: https://github.com/MrOtherGuy/firefox-csshacks/blob/master/chrome/hide_tabs_toolbar_v2.css
