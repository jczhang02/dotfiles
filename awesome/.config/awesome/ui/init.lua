require(... .. ".notifications")
require(... .. ".popups")

local top_panel = require(... .. ".panels.top-panel")
-- local central_panel = require(... .. ".panels.central-panel")

local awful = require("awful")
awful.screen.connect_for_each_screen(function(s)
	--- Panels
	top_panel(s)
	-- central_panel(s)
end)
