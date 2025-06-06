local awful = require("awful")
local bling = require("modules.bling")
local rubato = require("modules.awedock.rubato")

local _M = { last_focused_client = nil }

local anim_y = rubato.timed({
	pos = 1090,
	rate = 60,
	easing = rubato.quadratic,
	intro = 0.1,
	duration = 0.3,
	awestore_compat = true, -- This option must be set to true.
})

local anim_x = rubato.timed({
	pos = -970,
	rate = 60,
	easing = rubato.quadratic,
	intro = 0.1,
	duration = 0.3,
	awestore_compat = true, -- This option must be set to true.
})

local rubato_with_defaults = function(overrides)
	return rubato.timed({
		pos = overrides.pos or 0,
		rate = overrides.rate or 120,
		easing = overrides.easing or rubato.quadratic,
		intro = overrides.intro or 0.1,
		duration = overrides.duration or 0.4,
		awestore_compat = true,
	})
end

local restore_client = function()
	if _M.last_focused_client then
		_M.last_focused_client:jump_to()
		_M.last_focused_client = nil
	end
end

local music_scratch = function(screen_geometry)
	-- clamp the width and height to always fit on screen
	local width = math.min(screen_geometry.width * 0.40, 2400)
	local height = math.min(400, screen_geometry.height - 20)
	local x = (screen_geometry.width - width) / 2
	local y = ((screen_geometry.height - height) / 2) + screen_geometry.y
	local music = bling.module.scratchpad:new({
		command = "alacritty --class ncmpcpp -e ncmpcpp",
		rule = { instance = "ncmpcpp" },
		sticky = true,
		autoclose = false,
		geometry = { x = x, y = y, height = height, width = width },
		floating = true,
		reapply = true,
		rubato = {
			y = rubato_with_defaults({
				pos = -height,
				duration = 0.3,
			}),
		},
	})

	music:connect_signal("turn_off", restore_client)
	awesome.connect_signal("scratch::music", function()
		music:toggle()
	end)

	return music
end

local terminal_scratch = function(screen_geometry)
	-- clamp the width and height to always fit on screen
	local width = math.min(screen_geometry.width * 0.50, 2400)
	local height = math.min(600, screen_geometry.height - 20)
	local x = (screen_geometry.width - width) / 2
	local y = ((screen_geometry.height - height) / 2) + screen_geometry.y
	local term = bling.module.scratchpad:new({
		command = "alacritty --class term_pad",
		rule = { instance = "term_pad" },
		sticky = true,
		autoclose = false,
		geometry = { x = x, y = y, height = height, width = width },
		floating = true,
		reapply = true,
		rubato = {
			y = rubato_with_defaults({
				pos = -height,
			}),
		},
	})

	term:connect_signal("turn_off", restore_client)
	awesome.connect_signal("scratch::term", function()
		term:toggle()
	end)

	return term
end

local netease_scratch = function(screen_geometry)
	-- clamp the width and height to always fit on screen
	local width = math.min(screen_geometry.width * 0.70, 1000)
	local height = math.min(600, screen_geometry.height - 20)
	local x = (screen_geometry.width - width) / 2
	local y = ((screen_geometry.height - height) / 2) + screen_geometry.y

	local netease = bling.module.scratchpad:new({
		command = "env DESKTOPINTEGRATION=false /opt/YesPlayMusic/yesplaymusic",
		rule = { instance = "yesplaymusic" },
		sticky = false,
		autoclose = false,
		floating = true,
		geometry = { x = x, y = y, height = height, width = width },
		reapply = true,
		rubato = {
			y = anim_y,
		},
	})

	netease:connect_signal("turn_off", restore_client)
	awesome.connect_signal("scratch::netease", function()
		netease:toggle()
	end)

	return netease
end

local mathpix_scratch = function(screen_geometry)
	-- clamp the width and height to always fit on screen
	local width = math.min(screen_geometry.width * 0.70, 1000)
	local height = math.min(600, screen_geometry.height - 20)
	local x = (screen_geometry.width - width) / 2
	local y = ((screen_geometry.height - height) / 2) + screen_geometry.y

	local mathpix = bling.module.scratchpad:new({
		command = "/home/jc/.local/share/AppImage/mathpix.AppImage",
		rule = { instance = "snip.AppImage" },
		sticky = true,
		autoclose = false,
		floating = true,
		geometry = { x = x, y = y, height = height, width = width },
		reapply = true,
		rubato = {
			y = anim_y,
		},
	})

	mathpix:connect_signal("turn_off", restore_client)
	awesome.connect_signal("scratch::mathpix", function()
		mathpix:toggle()
	end)

	return mathpix
end

local tg_scratch = function(screen_geometry)
	local width = math.min(screen_geometry.width / 1.4, 2400)
	local height = screen_geometry.height * 0.80
	local x = (screen_geometry.width - width) / 2
	--local x = (screen_geometry.width - width - 20) + screen_geometry.x
	local y = (screen_geometry.height - height) / 2

	local tg = bling.module.scratchpad:new({
		command = "telegram-desktop",
		rule = { instance = "telegram-desktop" },
		sticky = false,
		autoclose = false,
		floating = true,
		geometry = { x = x, y = y, height = height, width = width },
		reapply = true,
		rubato = {
			y = rubato_with_defaults({}),
		},
	})

	tg:connect_signal("turn_off", restore_client)
	awesome.connect_signal("scratch::tg", function()
		tg:toggle()
	end)

	return tg
end

local pavucontrol_scratch = function(screen_geometry)
	local width = math.min(screen_geometry.width / 1.4, 2400)
	local height = screen_geometry.height * 0.80
	local x = (screen_geometry.width - width) / 2
	--local x = (screen_geometry.width - width - 20) + screen_geometry.x
	local y = (screen_geometry.height - height) / 2

	local pavucontrol = bling.module.scratchpad:new({
		command = "pavucontrol-qt",
		rule = { instance = "pavucontrol-qt" },
		sticky = false,
		autoclose = false,
		floating = true,
		geometry = { x = x, y = y, height = height, width = width },
		reapply = true,
		rubato = {
			y = rubato_with_defaults({}),
		},
	})

	pavucontrol:connect_signal("turn_off", restore_client)
	awesome.connect_signal("scratch::pavucontrol", function()
		pavucontrol:toggle()
	end)

	return pavucontrol
end

local blueman_scratch = function(screen_geometry)
	-- clamp the width and height to always fit on screen
	local width = math.min(screen_geometry.width * 0.70, 1000)
	local height = math.min(600, screen_geometry.height - 20)
	local x = (screen_geometry.width - width) / 2
	local y = ((screen_geometry.height - height) / 2) + screen_geometry.y

	local blueman = bling.module.scratchpad:new({
		command = "blueman-manager",
		rule = { instance = "blueman-manager" },
		sticky = true,
		autoclose = false,
		floating = true,
		geometry = { x = x, y = y, height = height, width = width },
		reapply = true,
		rubato = {
			y = anim_y,
		},
	})

	blueman:connect_signal("turn_off", restore_client)
	awesome.connect_signal("scratch::blueman", function()
		blueman:toggle()
	end)

	return blueman
end

local cherry_scratch = function(screen_geometry)
	-- clamp the width and height to always fit on screen

	local width = math.min(screen_geometry.width / 1.4, 2400)
	local height = screen_geometry.height * 0.80
	local x = (screen_geometry.width - width) / 2
	--local x = (screen_geometry.width - width - 20) + screen_geometry.x
	local y = (screen_geometry.height - height) / 2

	local cherry = bling.module.scratchpad:new({
		command = "/usr/bin/cherry-studio --ignore-additional-command-line-flags --ozone-platform-hint=auto --enable-wayland-ime %U",
		rule = { instance = "cherrystudio" },
		sticky = false,
		autoclose = false,
		floating = true,
		geometry = { x = x, y = y, height = height, width = width },
		reapply = true,
		rubato = {
			y = anim_y,
		},
	})

	cherry:connect_signal("turn_off", restore_client)
	awesome.connect_signal("scratch::cherry", function()
		cherry:toggle()
	end)

	return cherry
end

-- initialize scratchpads
_M.init = function()
	local scratchpads = {
		term = terminal_scratch,
		tg = tg_scratch,
		pavucontrol = pavucontrol_scratch,
		music = music_scratch,
		blueman = blueman_scratch,
		cherry = cherry_scratch,
	}

	for name, scratch in pairs(scratchpads) do
		_M[name] = scratch(awful.screen.focused().geometry)
	end
end

_M.toggle_and_restore = function(scratchpad)
	if not _M.last_focused_client then
		_M.last_focused_client = awful.screen.focus
	end

	awesome.emit_signal("scratch::" .. scratchpad)
end

return _M
