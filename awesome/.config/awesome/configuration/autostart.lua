local awful = require("awful")
-- local filesystem = require("gears.filesystem")
-- local config_dir = filesystem.get_configuration_dir()
local helpers = require("helpers")

local function autostart_apps()
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
			"picom --dbus --config /home/jc/.config/awesome/configuration/picom.conf > /home/jc/.config/awesome/logs/picom.log"
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

	awful.spawn.with_shell("xrdb -override /home/jc/.Xresources")

	helpers.run.run_once_grep("keepassxc")
end

autostart_apps()
