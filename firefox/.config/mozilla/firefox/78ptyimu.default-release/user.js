// Firefox re-applies this file at every startup, overriding about:config.
// Only put prefs here that should never change; set the rest in about:config.

// Load chrome/userChrome.css
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);

// Round the bottom window corners too, like GNOME/libadwaita apps (top ones already are)
user_pref("widget.gtk.rounded-bottom-corners.enabled", true);
