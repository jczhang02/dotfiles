local awful = require("awful")
-- local filesystem = require("gears.filesystem")
-- local config_dir = filesystem.get_configuration_dir()
local helpers = require("helpers")

local function autostart_apps()
	--- Multiscreen Support
	-- awful.spawn.with_shell("autorandr --load home")

	--- CopyQ Copyboard
	helpers.run.run_once_grep("copyq")

	--- Kdeconnect
	helpers.run.run_once_grep("/usr/lib64/libexec/kdeconnectd")

	--- Fcitx5
	helpers.run.run_once_grep("fcitx5")
	--- Powerkit
	-- helpers.run.run_once_pgrep("powerkit")

	--- Compositor
	helpers.run.check_if_running("picom", nil, function()
		awful.spawn.with_shell(
			"picom --experimental-backends --config /home/jc/.config/awesome/configuration/picom.conf > /home/jc/.config/awesome/logs/picom.log"
		)
	end)

	-- helpers.run.run_once_pgrep("mpd")
	-- helpers.run.run_once_pgrep("mpDris2")

	--- Polkit Agent
	helpers.run.run_once_grep("/usr/libexec/polkit-gnome-authentication-agent-1")

	--- libinput-guesture
	helpers.run.run_once_grep("libinput-gestures-setup start")

	--- Other stuff
	helpers.run.run_once_grep("blueman-applet")
	helpers.run.run_once_grep("nm-tray")

	--- Wallpapers.
	awful.spawn.with_shell("nitrogen --restore")

	awful.spawn.with_shell("xrdb /home/jc/.Xresources")

	awful.spawn.with_shell("keepassxc")

	--- VNC

	-- awful.spawn.with_shell("start x11vnc -rfbauth ~/.vnc/passwd -display :0 -noxdamage -bg -forever")

	--- Inkscape script
	-- awful.spawn.with_shell("sh /home/jc/.scripts/inkscape_shortcut_start.sh &")
	-- awful.spawn.with_shell("inkscape-figures watch")

	-- awful.spawn.with_shell("/usr/lib/pam_kwallet_init")

	-- awful.spawn.with_shell(
	-- 	"dbus-update-activation-environment --all && gnome-keyring-daemon --start --components=secrets"
	-- )

	--- Redshift
	-- helpers.run.check_if_running("redshift", nil, function()
	-- 	awful.spawn.with_shell("sh ~/.scripts/redshift.sh")
	-- end)

	-- helpers.run.run_once_grep("earbuds")
end

autostart_apps()
