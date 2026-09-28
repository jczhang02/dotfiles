import Shell from 'gi://Shell';

import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';

// Mutter implements no data-control protocol, so wl-copy maps a transient
// window to gain focus. GNOME tracks it as a running app, and every copy from
// a terminal program flashes an icon in the dock. Drop it from the running
// list that the Dash and Dash to Dock build from.
const HIDDEN_APP_ID = 'io.github.bugaevc.wl-clipboard';

function isHidden(app) {
    const windows = app.get_windows();
    return windows.length > 0 &&
        windows.every(w => w.get_wm_class() === HIDDEN_APP_ID);
}

export default class HideWlClipboardExtension extends Extension {
    enable() {
        this._injections = new InjectionManager();
        this._injections.overrideMethod(Shell.AppSystem.prototype, 'get_running',
            original => function (...args) {
                return original.call(this, ...args).filter(app => !isHidden(app));
            });
    }

    disable() {
        this._injections.clear();
        this._injections = null;
    }
}
