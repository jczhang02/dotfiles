local awful = require("awful")
local beautiful = require("beautiful")
local ruled = require("ruled")
local helpers = require("helpers")

--- Get screen geometry
local screen_width = awful.screen.focused().geometry.width
local screen_height = awful.screen.focused().geometry.height

ruled.client.connect_signal("request::rules", function()
	--- Global
	ruled.client.append_rule({
		id = "global",
		rule = {},
		properties = {
			raise = true,
			size_hints_honor = false,
			honor_workarea = true,
			honor_padding = true,
			-- screen = awful.screen.preferred,
			screen = awful.screen.focused,
			focus = awful.client.focus.filter,
			titlebars_enabled = beautiful.titlebar_enabled,
			placement = awful.placement.no_overlap + awful.placement.no_offscreen,
		},
	})

	--- Tasklist order
	ruled.client.append_rule({
		id = "tasklist_order",
		rule = {},
		properties = {},
		callback = awful.client.setslave,
	})

	--- Titlebar rules
	ruled.client.append_rule({
		id = "titlebars",
		rule_any = {
			class = {
				"Spotify",
				"Org.gnome.Nautilus",
				"Peek",
			},
		},
		properties = {
			titlebars_enabled = false,
		},
	})

	--- Float
	ruled.client.append_rule({
		id = "floating",
		rule_any = {
			instance = {
				"Devtools", --- Firefox devtools
			},
			class = {
				"Lxappearance",
				"Nm-connection-editor",
				"Kvantum Manager",
			},
			name = {
				"Event Tester", -- xev
			},
			role = {
				"AlarmWindow",
				"pop-up",
				"GtkFileChooserDialog",
				"conversation",
			},
			type = {
				"dialog",
			},
		},
		properties = { floating = true, placement = helpers.client.centered_client_placement },
	})

	--- Centered
	ruled.client.append_rule({
		id = "centered",
		rule_any = {
			type = {
				"dialog",
			},
			class = {
				--- "discord",
				"xdg-desktop-portal-gtk",
			},
			role = {
				"GtkFileChooserDialog",
				"conversation",
			},
		},
		properties = { placement = helpers.client.centered_client_placement },
	})

	--- Music clients (usually a terminal running ncmpcpp)
	ruled.client.append_rule({
		rule_any = {
			class = {
				"music",
			},
			instance = {
				"music",
			},
		},
		properties = {
			floating = true,
			width = screen_width * 0.40,
			height = screen_height * 0.42,
			placement = helpers.client.centered_client_placement,
		},
	})

	ruled.client.append_rule({
		rule_any = {
			class = {
				"wechat",
			},
			instance = {
				"wechat",
			},
		},
		properties = {
			floating = true,
			width = screen_width * 0.40,
			height = screen_height * 0.60,
			placement = helpers.client.centered_client_placement,
		},
	})

	-- CopyQ
	ruled.client.append_rule({
		id = "copyq",
		rule_any = {
			instance = { "copyq" },
			class = { "copyq" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = screen_width * 0.4,
			height = screen_height * 0.6,
		},
	})

	-- scrcpy
	ruled.client.append_rule({
		id = "scrcpy",
		rule_any = {
			instance = { "scrcpy" },
			class = { "scrcpy" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = screen_width * 0.8,
			height = screen_height * 0.8,
		},
	})

	-- keepassxc
	ruled.client.append_rule({
		id = "keepassxc",
		rule_any = {
			class = { "KeePassXC" },
		},
		except_any = { name = { "KeePassXC-Browser Confirm Access" }, type = { "dialog" } },
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = screen_width * 0.8,
			height = screen_height * 0.8,
			minimized = true,
		},
	})

	-- CopyQ
	ruled.client.append_rule({
		id = "vncviewer",
		rule_any = {
			instance = { "vncviewer" },
			class = { "vncviewer" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = 800,
			height = 600,
		},
	})

	-- Unison-gtk
	ruled.client.append_rule({
		id = "unison",
		rule_any = {
			instance = { "unison" },
			class = { "unison" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = 800,
			height = 600,
		},
	})

	-- Unison-gtk
	ruled.client.append_rule({
		id = "unison",
		rule_any = {
			instance = { "unison-2.53" },
			class = { "unison-2.53" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = 800,
			height = 600,
		},
	})

	-- Qt5ct
	ruled.client.append_rule({
		id = "qt5ct",
		rule_any = {
			instance = { "qt5ct" },
			class = { "qt5ct" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = screen_width * 0.4,
			height = screen_height * 0.6,
		},
	})

	ruled.client.append_rule({
		id = "noisetorch",
		rule_any = {
			instance = { "NoiseTorch" },
			class = { "NoiseTorch" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = screen_width * 0.4,
			height = screen_height * 0.6,
		},
	})

	ruled.client.append_rule({
		id = "pinentry",
		rule_any = {
			instance = { "pinentry" },
			class = { "pinentry" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = screen_width * 0.4,
			height = screen_height * 0.6,
		},
	})

	ruled.client.append_rule({
		id = "pidgin",
		rule_any = {
			instance = { "Pidgin" },
			class = { "Pidgin" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = screen_width * 0.4,
			height = screen_height * 0.6,
		},
	})

	-- Mathpix-snip-tool
	ruled.client.append_rule({
		id = "mathpix",
		rule_any = {
			instance = { "mathpix-snipping-tool" },
			class = { "Mathpix Snipping Tool" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = screen_width * 0.4,
			height = screen_height * 0.6,
		},
	})

	-- Catfish
	ruled.client.append_rule({
		id = "catfish",
		rule_any = {
			instance = { "catfish" },
			class = { "Catfish" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = screen_width * 0.6,
			height = screen_height * 0.6,
		},
	})

	-- Zoom
	ruled.client.append_rule({
		id = "zoom",
		rule_any = {
			instance = { "zoom " },
			class = { "zoom " },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
		},
	})

	ruled.client.append_rule({
		id = "com.alibabainc.dingtalk",
		rule_any = {
			instance = { "com.alibabainc.dingtalk " },
			class = { "com.alibabainc.dingtalk " },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
		},
	})

	-- Wemeet
	ruled.client.append_rule({
		id = "wemeet",
		rule_any = {
			instance = { "wemeetapp" },
			class = { "wemeetapp" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
		},
	})

	--- Blueman
	ruled.client.append_rule({
		id = "blueman-manager",
		rule_any = {
			instance = { "blueman-manager" },
			class = { "Blueman-manager" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = screen_width * 0.6,
			height = screen_height * 0.6,
		},
	})

	-- gcr-prompter
	ruled.client.append_rule({
		id = "gcr-prompter",
		rule_any = {
			instance = { "gcr-prompter" },
			class = { "Gcr-prompter" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = screen_width * 0.3,
			height = screen_height * 0.2,
		},
	})

	ruled.client.append_rule({
		id = "virt-manager",
		rule_any = {
			instance = { "virt-manager" },
			class = { "Virt-manager" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = screen_width * 0.8,
			height = screen_height * 0.8,
		},
	})

	-- Gnome terminal serve as Neovim runner
	ruled.client.append_rule({
		id = "gnome-terminal",
		rule_any = {
			instance = { "gnome-terminal-server" },
			class = { "Gnome-terminal" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = screen_width * 0.4,
			height = screen_height * 0.4,
		},
	})

	--- MATLAB workspace
	ruled.client.append_rule({
		id = "MatlabWorkspace",
		rule_any = {
			name = "Workspace",
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = screen_width * 0.4,
			height = screen_height * 0.4,
		},
	})

	-- Matplotlib
	ruled.client.append_rule({
		id = "matplotlib",
		rule_any = {
			instance = { "matplotlib" },
			class = { "matplotlib" },
		},
		properties = {
			floating = true,
			placement = helpers.client.centered_client_placement,
			width = screen_width * 0.4,
			height = screen_height * 0.4,
		},
	})

	ruled.client.append_rule({
		rule = { class = "mpv" },
		properties = {},
		callback = function(c)
			-- make it floating, ontop and move it out of the way if the current tag is maximized
			if awful.layout.get(awful.screen.focused()) == awful.layout.suit.floating then
				c.floating = true
				c.ontop = true
				c.width = screen_width * 0.30
				c.height = screen_height * 0.35
				awful.placement.bottom_right(c, {
					honor_padding = true,
					honor_workarea = true,
					margins = { bottom = beautiful.useless_gap * 2, right = beautiful.useless_gap * 2 },
				})
				awful.titlebar.hide(c, beautiful.titlebar_pos)
			end

			-- restore `ontop` after fullscreen is disabled
			c:connect_signal("property::fullscreen", function()
				if not c.fullscreen then
					c.ontop = true
				end
			end)
		end,
	})

	--- Image viewers
	ruled.client.append_rule({
		rule_any = {
			class = {
				"feh",
				"imv",
				"qimgv",
				"sxiv",
				"Sxiv",
			},
		},
		properties = {
			floating = true,
			width = screen_width * 0.7,
			height = screen_height * 0.75,
		},
		callback = function(c)
			awful.placement.centered(c, { honor_padding = true, honor_workarea = true })
		end,
	})
end)
