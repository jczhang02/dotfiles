local awful = require("awful")
local bling = require("module.bling")
local rubato = require("module.rubato")

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

local spotify_scratch = function(screen_geometry)
	-- clamp the width and height to always fit on screen
	local width = math.min(screen_geometry.width * 0.70, 2000)
	local height = math.min(800, screen_geometry.height - 20)
	local x = (screen_geometry.width - width) / 2
	local y = ((screen_geometry.height - height) / 2) + screen_geometry.y

	local spotify = bling.module.scratchpad:new({
		command = "proxychains spotify",
		rule = { instance = "spotify" },
		sticky = true,
		autoclose = false,
		floating = true,
		geometry = { x = x, y = y, height = height, width = width },
		reapply = true,
		rubato = { y = anim_y },
	})

	spotify:connect_signal("turn_off", restore_client)
	awesome.connect_signal("scratch::spotify", function()
		spotify:toggle()
	end)

	return spotify
end

local netease_scratch = function(screen_geometry)
	-- clamp the width and height to always fit on screen
	local width = math.min(screen_geometry.width * 0.70, 1000)
	local height = math.min(600, screen_geometry.height - 20)
	local x = (screen_geometry.width - width) / 2
	local y = ((screen_geometry.height - height) / 2) + screen_geometry.y

	local netease = bling.module.scratchpad:new({
		command = "/opt/YesPlayMusic/yesplaymusic",
		rule = { instance = "yesplaymusic" },
		sticky = true,
		autoclose = false,
		floating = true,
		geometry = { x = x, y = y, height = height, width = width },
		reapply = true,
		rubato = {
			y = rubato_with_defaults({}),
		},
	})

	netease:connect_signal("turn_off", restore_client)
	awesome.connect_signal("scratch::netease", function()
		netease:toggle()
	end)

	return netease
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
			x = rubato_with_defaults({
				pos = -(screen_geometry.width + width + screen_geometry.x),
			}),
		},
	})

	tg:connect_signal("turn_off", restore_client)
	awesome.connect_signal("scratch::tg", function()
		tg:toggle()
	end)

	return tg
end

local qv2ray_scratch = function(screen_geometry)
	local width = math.min(screen_geometry.width / 1.4, 2400)
	local height = screen_geometry.height * 0.80
	local x = (screen_geometry.width - width) / 2
	--local x = (screen_geometry.width - width - 20) + screen_geometry.x
	local y = (screen_geometry.height - height) / 2

	local qv2ray = bling.module.scratchpad:new({
		command = "qv2ray",
		rule = { instance = "qv2ray" },
		sticky = false,
		autoclose = false,
		floating = true,
		geometry = { x = x, y = y, height = height, width = width },
		reapply = true,
		rubato = {
			y = rubato_with_defaults({}),
		},
	})

	qv2ray:connect_signal("turn_off", restore_client)
	awesome.connect_signal("scratch::qv2ray", function()
		qv2ray:toggle()
	end)

	return qv2ray
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
			x = rubato_with_defaults({
				pos = -(screen_geometry.width + width + screen_geometry.x),
			}),
		},
	})

	pavucontrol:connect_signal("turn_off", restore_client)
	awesome.connect_signal("scratch::pavucontrol", function()
		pavucontrol:toggle()
	end)

	return pavucontrol
end

local fsearch_scratch = function(screen_geometry)
	local width = math.min(screen_geometry.width / 1.4, 2400)
	local height = screen_geometry.height * 0.80
	local x = (screen_geometry.width - width) / 2
	--local x = (screen_geometry.width - width - 20) + screen_geometry.x
	local y = (screen_geometry.height - height) / 2

	local fsearch = bling.module.scratchpad:new({
		command = "fsearch",
		rule = { instance = "fsearch" },
		sticky = false,
		autoclose = false,
		floating = true,
		geometry = { x = x, y = y, height = height, width = width },
		reapply = true,
		rubato = {
			x = rubato_with_defaults({
				pos = -(screen_geometry.width + width + screen_geometry.x),
			}),
		},
	})

	fsearch:connect_signal("turn_off", restore_client)
	awesome.connect_signal("scratch::fsearch", function()
		fsearch:toggle()
	end)

	return fsearch
end

local galaxy_scratch = function(screen_geometry)
	-- clamp the width and height to always fit on screen
	local width = math.min(screen_geometry.width * 0.50, 2400)
	local height = math.min(600, screen_geometry.height - 20)
	local x = (screen_geometry.width - width) / 2
	local y = ((screen_geometry.height - height) / 2) + screen_geometry.y
	local galaxy = bling.module.scratchpad:new({
		command = "galaxybudsclient",
		rule = { class = "GalaxyBudsClient" },
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

	galaxy:connect_signal("turn_off", restore_client)
	awesome.connect_signal("scratch::galaxy", function()
		galaxy:toggle()
	end)

	return galaxy
end

-- initialize scratchpads
_M.init = function()
	local scratchpads = {
		term = terminal_scratch,
		spotify = spotify_scratch,
		netease = netease_scratch,
		tg = tg_scratch,
		qv2ray = qv2ray_scratch,
		pavucontrol = pavucontrol_scratch,
		fsearch = fsearch_scratch,
		galaxy = galaxy_scratch,
	}

	for name, scratch in pairs(scratchpads) do
		_M[name] = scratch(awful.screen.focused().geometry)
	end
end

_M.toggle_and_restore = function(scratchpad)
	if not _M.last_focused_client then
		_M.last_focused_client = screen.focus
	end

	awesome.emit_signal("scratch::" .. scratchpad)
end

return _M
