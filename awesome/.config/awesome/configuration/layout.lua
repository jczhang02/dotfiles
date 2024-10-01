local awful = require("awful")
local bling = require("modules.bling")
local machi = require("modules.layout-machi")

--- Custom Layouts
local mstab = bling.layout.mstab
local centered = bling.layout.centered
local equal = bling.layout.equalarea
local deck = bling.layout.deck
local termfair = require("modules.lain.layout.termfair")
local cascade = require("modules.lain.layout.cascade")
local centerwork = require("modules.lain.layout.centerwork")

machi.editor.nested_layouts = {
	["0"] = equal,
	["1"] = deck,
	["2"] = awful.layout.suit.spiral,
	["3"] = awful.layout.suit.fair,
	["4"] = centered,
	-- ["3"] = awful.layout.suit.fair.horizontal,
}

--- Set the layouts
tag.connect_signal("request::default_layouts", function()
	awful.layout.append_default_layouts({
		equal,
		centerwork,
		termfair,
		cascade,
		machi.default_layout,
	})
end)
