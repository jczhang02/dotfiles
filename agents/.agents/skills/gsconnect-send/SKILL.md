---
name: gsconnect-send
description: Send any local file to phone through GSConnect.
disable-model-invocation: true
---

# GSConnect Send

Send one local file to a paired phone through GSConnect. This is a user-invoked skill: run it only when the user explicitly asks for this skill or explicitly asks to send a file through GSConnect.

## Steps

1. **Resolve file**
   - If the user gave a path, use it.
   - If the user says "刚才那个文件/PDF" or similar, use the most recent explicit file path from the conversation.
   - If no path is clear and the current directory has exactly one plausible file, use it.
   - If multiple files could match, ask the user to choose.
   - Completion criterion: exactly one existing regular file path is resolved.

2. **Find paired connected devices**
   - Use GSConnect D-Bus, not KDE Connect CLI unless GSConnect is unavailable.
   - Device root: `/org/gnome/Shell/Extensions/GSConnect/Device`.
   - Device interface: `org.gnome.Shell.Extensions.GSConnect.Device`.
   - Completion criterion: connected+paired devices are counted, with names and object paths known.

3. **Choose device**
   - If one connected+paired device exists, use it.
   - If multiple connected+paired devices exist, ask the user which one.
   - If none exist, stop and tell the user to open/enable GSConnect/KDE Connect on the phone and desktop.
   - Completion criterion: exactly one device object path is selected.

4. **Send file**
   - Convert the file path to a `file://` URI with proper escaping.
   - Activate the device `shareFile` action with parameter signature `(sb)`.
   - Completion criterion: `gdbus` returns success and the response is reported to the user.

5. **Report**
   - Say which file was sent and to which device.
   - Do not claim phone-side receipt beyond GSConnect accepting the transfer.
   - Completion criterion: final response contains file path and device name.

## Command pattern

Use this as the default implementation, after Step 1 resolves the file. Run it with bash, never in the session's own shell: it uses `mapfile` and bash arrays, and zsh (the Claude Code shell on JC's machine) fails with `command not found: mapfile`. Pass the file as the first argument: `bash -s -- "<file>" <<'EOF'` ... `EOF`, or save the script to a temporary file and run `bash <script> "<file>"`.

```bash
TARGET_FILE="$1"
DEST="org.gnome.Shell.Extensions.GSConnect"
DEVICE_ROOT="/org/gnome/Shell/Extensions/GSConnect/Device"
IFACE="org.gnome.Shell.Extensions.GSConnect.Device"

ABS_FILE=$(realpath "$TARGET_FILE")
test -f "$ABS_FILE" || { echo "missing file: $ABS_FILE" >&2; exit 1; }

URI=$(python3 - "$ABS_FILE" <<'PY'
from pathlib import Path
import sys
print(Path(sys.argv[1]).resolve().as_uri())
PY
)

mapfile -t IDS < <(
  gdbus introspect --session --dest "$DEST" --object-path "$DEVICE_ROOT" \
    | sed -n 's/.*node \([^ ;]*\).*/\1/p'
)

selected_path=""
selected_name=""
for id in "${IDS[@]}"; do
  path="$DEVICE_ROOT/$id"
  connected=$(gdbus call --session --dest "$DEST" --object-path "$path" \
    --method org.freedesktop.DBus.Properties.Get "$IFACE" Connected 2>/dev/null || true)
  paired=$(gdbus call --session --dest "$DEST" --object-path "$path" \
    --method org.freedesktop.DBus.Properties.Get "$IFACE" Paired 2>/dev/null || true)
  name_raw=$(gdbus call --session --dest "$DEST" --object-path "$path" \
    --method org.freedesktop.DBus.Properties.Get "$IFACE" Name 2>/dev/null || true)
  name=$(printf '%s\n' "$name_raw" | sed "s/.*<'\(.*\)'>.*/\1/")

  if printf '%s' "$connected" | grep -q '<true>' && printf '%s' "$paired" | grep -q '<true>'; then
    if [ -n "$selected_path" ]; then
      echo "multiple connected devices; ask user to choose" >&2
      echo "$selected_name -> $selected_path" >&2
      echo "$name -> $path" >&2
      exit 2
    fi
    selected_path="$path"
    selected_name="$name"
  fi
done

if [ -z "$selected_path" ]; then
  echo "no paired connected GSConnect device" >&2
  exit 3
fi

gdbus call --session --dest "$DEST" --object-path "$selected_path" \
  --method org.gtk.Actions.Activate \
  shareFile "[<('$URI', false)>]" "{}"

echo "sent: $ABS_FILE -> $selected_name"
```

## Fallbacks

- If `org.gnome.Shell.Extensions.GSConnect` is absent, check whether GSConnect is running:

```bash
busctl --user list | grep -i gsconnect
```

- If `gdbus` is missing, stop and report the missing command. Do not invent another transport.

## Safety

Sending a file is an external side effect. This skill is already user-invoked, so do not ask for a second confirmation when the target file and single device are unambiguous. Ask only when the file or device is ambiguous.
