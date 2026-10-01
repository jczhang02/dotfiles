// Firefox re-applies this file at every startup, overriding about:config.
// Only put prefs here that should never change; set the rest in about:config.

// Load chrome/userChrome.css
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);

// Round the bottom window corners too, like GNOME/libadwaita apps (top ones already are)
user_pref("widget.gtk.rounded-bottom-corners.enabled", true);

// Homepage: the start page in chrome/startpage
user_pref("browser.startup.homepage", "file:///home/jc/.config/mozilla/firefox/78ptyimu.default-release/chrome/startpage/index.html");
