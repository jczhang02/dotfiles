# GSConnect Screenshot Share

Local GNOME Shell extension. Adds **Copy Image** and **Send to Phone** to GNOME screenshot notifications. **Copy Image** restores the screenshot to the clipboard; **Send to Phone** calls:

```bash
~/.local/bin/gsconnect-send-file /path/to/screenshot.png
```

## Device selection

Default: use only connected + paired GSConnect device. If multiple devices are connected, pin one device id:

```bash
/usr/share/gnome-shell/extensions/gsconnect@andyholmes.github.io/service/daemon.js --list-all
mkdir -p ~/.config/gsconnect-screenshot-share
echo DEVICE_ID > ~/.config/gsconnect-screenshot-share/device
```

Alternative env vars:

```bash
GSCONNECT_DEVICE=DEVICE_ID ~/.local/bin/gsconnect-send-file FILE
GSCONNECT_DEVICE_NAME='Phone Name' ~/.local/bin/gsconnect-send-file FILE
```

## Enable/reload

Already added to `org.gnome.shell enabled-extensions`. GNOME Shell on Wayland usually needs logout/login before newly created extension appears.
