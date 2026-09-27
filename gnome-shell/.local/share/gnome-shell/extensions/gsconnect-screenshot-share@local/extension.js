import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

const TAG = '[gsconnect-screenshot-share]';
const ACTION_LABEL = 'Send to Phone';
const COPY_ACTION_LABEL = 'Copy Image';
const RECENT_MS = 20_000;
const RETRY_DELAY_MS = 250;
const MAX_RETRIES = 12;
const SEND_SCRIPT = GLib.build_filenamev([
    GLib.get_home_dir(),
    '.local',
    'bin',
    'gsconnect-send-file',
]);

function text(value) {
    if (typeof value === 'string')
        return value;
    if (value === null || value === undefined)
        return '';
    return `${value}`;
}

function lower(value) {
    return text(value).toLowerCase();
}

function fileMtimeMs(info) {
    if (info.has_attribute('time::modified'))
        return Number(info.get_attribute_uint64('time::modified')) * 1000;
    return Date.now();
}

export default class GSConnectScreenshotShareExtension extends Extension {
    enable() {
        this._timeouts = new Set();
        this._monitors = [];
        this._candidateDirs = this._buildCandidateDirs();
        this._latestScreenshotPath = this._findLatestScreenshot();

        this._watchScreenshotDirs();
        this._patchNotifications();

        console.log(`${TAG} enabled`);
    }

    disable() {
        this._unpatchNotifications();

        for (const id of this._timeouts)
            GLib.Source.remove(id);
        this._timeouts.clear();

        for (const monitor of this._monitors)
            monitor.cancel();
        this._monitors = [];

        this._candidateDirs = [];
        this._latestScreenshotPath = null;

        console.log(`${TAG} disabled`);
    }

    _patchNotifications() {
        if (this._originalAddNotification)
            return;

        this._originalAddNotification = MessageTray.Source.prototype.addNotification;
        const extension = this;

        this._patchedAddNotification = function(notification) {
            extension._attachActionSoon(notification, this, 0);
            return extension._originalAddNotification.call(this, notification);
        };

        MessageTray.Source.prototype.addNotification = this._patchedAddNotification;
    }

    _unpatchNotifications() {
        if (!this._originalAddNotification)
            return;

        if (MessageTray.Source.prototype.addNotification === this._patchedAddNotification) {
            MessageTray.Source.prototype.addNotification = this._originalAddNotification;
        } else {
            console.warn(`${TAG} notification hook changed by another extension; leaving it in place`);
        }

        this._originalAddNotification = null;
        this._patchedAddNotification = null;
    }

    _buildCandidateDirs() {
        const dirs = new Set();
        const home = GLib.get_home_dir();
        const pictures = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES) ||
            GLib.build_filenamev([home, 'Pictures']);

        for (const dir of [
            pictures,
            GLib.build_filenamev([pictures, 'Screenshots']),
            GLib.build_filenamev([home, 'Pictures']),
            GLib.build_filenamev([home, 'Pictures', 'Screenshots']),
        ]) {
            if (!dir)
                continue;
            if (Gio.File.new_for_path(dir).query_exists(null))
                dirs.add(dir);
        }

        return [...dirs];
    }

    _watchScreenshotDirs() {
        const interestingEvents = new Set([
            Gio.FileMonitorEvent.CREATED,
            Gio.FileMonitorEvent.CHANGES_DONE_HINT,
            Gio.FileMonitorEvent.MOVED_IN,
            Gio.FileMonitorEvent.RENAMED,
        ]);

        for (const dir of this._candidateDirs) {
            try {
                const file = Gio.File.new_for_path(dir);
                const monitor = file.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
                const handlerId = monitor.connect('changed', (_monitor, changedFile, otherFile, eventType) => {
                    if (!interestingEvents.has(eventType))
                        return;

                    this._maybeRecordScreenshot(changedFile?.get_path());
                    this._maybeRecordScreenshot(otherFile?.get_path());
                });

                monitor._gsconnectScreenshotShareHandlerId = handlerId;
                this._monitors.push(monitor);
            } catch (error) {
                console.warn(`${TAG} failed to watch ${dir}: ${error.message}`);
            }
        }
    }

    _looksLikeScreenshotPath(path) {
        const value = lower(path);
        if (!value.match(/\.(png|jpe?g|webp)$/))
            return false;

        const basename = lower(GLib.path_get_basename(path));
        const dirname = lower(GLib.path_get_dirname(path));

        return basename.includes('screenshot') ||
            basename.includes('screen shot') ||
            dirname.endsWith('/screenshots') ||
            dirname.includes('/screenshots/');
    }

    _pathReady(path) {
        if (!path || !this._looksLikeScreenshotPath(path))
            return false;

        try {
            const file = Gio.File.new_for_path(path);
            const info = file.query_info(
                'standard::type,time::modified',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            if (info.get_file_type() !== Gio.FileType.REGULAR)
                return false;

            return Date.now() - fileMtimeMs(info) <= RECENT_MS;
        } catch {
            return false;
        }
    }

    _maybeRecordScreenshot(path) {
        if (this._pathReady(path))
            this._latestScreenshotPath = path;
    }

    _findLatestScreenshot() {
        let latestPath = null;
        let latestMtime = 0;

        for (const dir of this._candidateDirs) {
            try {
                const directory = Gio.File.new_for_path(dir);
                const enumerator = directory.enumerate_children(
                    'standard::name,standard::type,time::modified',
                    Gio.FileQueryInfoFlags.NONE,
                    null
                );

                let info;
                while ((info = enumerator.next_file(null)) !== null) {
                    if (info.get_file_type() !== Gio.FileType.REGULAR)
                        continue;

                    const path = GLib.build_filenamev([dir, info.get_name()]);
                    if (!this._looksLikeScreenshotPath(path))
                        continue;

                    const mtime = fileMtimeMs(info);
                    if (Date.now() - mtime > RECENT_MS)
                        continue;

                    if (mtime > latestMtime) {
                        latestPath = path;
                        latestMtime = mtime;
                    }
                }

                enumerator.close(null);
            } catch (error) {
                console.warn(`${TAG} failed to scan ${dir}: ${error.message}`);
            }
        }

        return latestPath;
    }

    _isScreenshotNotification(notification, source) {
        const title = lower(notification?.title ?? notification?._title);
        const body = lower(notification?.body ?? notification?._body);
        const sourceTitle = lower(source?.title ?? source?._title ?? notification?.source?.title);
        const sourceName = lower(source?.name ?? source?._name);

        return title.includes('screenshot captured') ||
            title.includes('screenshot') && sourceTitle.includes('screen capture') ||
            body.includes('paste the image from the clipboard') && sourceTitle.includes('screen capture') ||
            sourceName.includes('screenshot') ||
            sourceTitle.includes('screen capture') && title.includes('captured');
    }

    _attachActionSoon(notification, source, attempt) {
        if (!notification || notification._gsconnectScreenshotShareAttached)
            return;
        if (typeof notification.addAction !== 'function')
            return;
        if (!this._isScreenshotNotification(notification, source))
            return;

        const path = this._latestScreenshotPath || this._findLatestScreenshot();
        if (this._pathReady(path)) {
            notification._gsconnectScreenshotShareAttached = true;
            this._latestScreenshotPath = path;
            notification.addAction(COPY_ACTION_LABEL, () => this._copyImage(path));
            notification.addAction(ACTION_LABEL, () => this._sendFile(path));
            return;
        }

        if (attempt >= MAX_RETRIES)
            return;

        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, RETRY_DELAY_MS, () => {
            this._timeouts.delete(id);
            this._attachActionSoon(notification, source, attempt + 1);
            return GLib.SOURCE_REMOVE;
        });
        this._timeouts.add(id);
    }

    _notify(title, body) {
        try {
            Main.notify(title, body);
        } catch (error) {
            console.warn(`${TAG} ${title}: ${body} (${error.message})`);
        }
    }

    _copyImage(path) {
        try {
            const [success, contents] = Gio.File.new_for_path(path).load_contents(null);
            if (!success)
                throw new Error(`could not read ${path}`);

            const [mimeType] = Gio.content_type_guess(path, contents);
            const source = Meta.SelectionSourceMemory.new(
                mimeType,
                GLib.Bytes.new(contents)
            );
            global.display.get_selection().set_owner(
                Meta.SelectionType.SELECTION_CLIPBOARD,
                source
            );
        } catch (error) {
            console.warn(`${TAG} copy failed: ${error.message}`);
            this._notify('Failed to copy screenshot', error.message);
        }
    }

    _sendFile(path) {
        if (!Gio.File.new_for_path(SEND_SCRIPT).query_exists(null)) {
            this._notify('GSConnect screenshot share', `${SEND_SCRIPT} not found`);
            return;
        }

        try {
            const proc = Gio.Subprocess.new(
                [SEND_SCRIPT, path],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            proc.communicate_utf8_async(null, null, (subprocess, result) => {
                try {
                    const [, stdout, stderr] = subprocess.communicate_utf8_finish(result);
                    const output = text(stdout || stderr).trim();

                    if (subprocess.get_successful()) {
                        this._notify('Screenshot sent to phone', output || GLib.path_get_basename(path));
                    } else {
                        this._notify('Failed to send screenshot', output || `exit ${subprocess.get_exit_status()}`);
                    }
                } catch (error) {
                    console.warn(`${TAG} send failed: ${error.message}`);
                    this._notify('Failed to send screenshot', error.message);
                }
            });
        } catch (error) {
            console.warn(`${TAG} send failed: ${error.message}`);
            this._notify('Failed to send screenshot', error.message);
        }
    }
}
