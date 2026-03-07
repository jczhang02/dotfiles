local awful = require("awful")
local wibox = require("wibox")
local beautiful = require("beautiful")
local dpi = require("beautiful").xresources.apply_dpi
local helpers = require("helpers")
local wbutton = require("ui.widgets.button")
require("signal.claude_usage")

--- Claude Code Usage Widget
--- ~~~~~~~~~~~~~~~~~~~~~~~~

return function()
	local function color_for_value(value)
		if value < 0 then
			return beautiful.overlay2
		elseif value >= 90 then
			return beautiful.red
		elseif value >= 65 then
			return beautiful.pink
		else
			return beautiful.text
		end
	end

	local label_text = wibox.widget({
		markup = helpers.ui.colorize_text("CC", beautiful.text),
		font = beautiful.font_name .. "Bold 10",
		align = "center",
		valign = "center",
		widget = wibox.widget.textbox,
	})

	local five_hour_text = wibox.widget({
		markup = helpers.ui.colorize_text("…", beautiful.overlay2),
		font = beautiful.font_name .. "Medium 10",
		align = "center",
		valign = "center",
		widget = wibox.widget.textbox,
	})

	local seven_day_text = wibox.widget({
		markup = helpers.ui.colorize_text("…", beautiful.overlay2),
		font = beautiful.font_name .. "Medium 10",
		align = "center",
		valign = "center",
		widget = wibox.widget.textbox,
	})

	local sep = wibox.widget({
		markup = helpers.ui.colorize_text("/", beautiful.overlay2),
		font = beautiful.font_name .. "Medium 10",
		align = "center",
		valign = "center",
		widget = wibox.widget.textbox,
	})

	local usage_numbers = wibox.widget({
		layout = wibox.layout.fixed.horizontal,
		spacing = dpi(3),
		five_hour_text,
		sep,
		seven_day_text,
	})

	local usage_widget = wibox.widget({
		layout = wibox.layout.fixed.horizontal,
		spacing = dpi(8),
		label_text,
		usage_numbers,
	})

	local widget = wbutton.elevated.state({
		child = usage_widget,
		normal_bg = beautiful.wibar_bg,
	})

	local tooltip = awful.tooltip({
		objects = { widget },
		align = "bottom",
		font = beautiful.font_name .. "Medium 10",
		margins = dpi(8),
	})
	tooltip.text = "Loading…"

	local function parse_iso8601(s)
		if not s or s == "" then return nil end
		local y, m, d, H, M, S = s:match("(%d+)-(%d+)-(%d+)T(%d+):(%d+):(%d+)")
		if not y then return nil end
		return os.time({ year = y, month = m, day = d, hour = H, min = M, sec = S })
	end

	local function format_remaining(seconds)
		if seconds <= 0 then return "now" end
		local d = math.floor(seconds / 86400)
		local h = math.floor(seconds % 86400 / 3600)
		local m = math.floor(seconds % 3600 / 60)
		if d > 0 then return d .. "d " .. h .. "h" end
		if h > 0 then return h .. "h " .. m .. "m" end
		return m .. "m"
	end

	widget:connect_signal("button::press", function(_, _, _, button)
		if button == 1 then
			awesome.emit_signal("signal::claude_usage_refresh")
		elseif button == 3 then
			awful.spawn("xdg-open https://claude.ai/settings/usage")
		end
	end)

	awesome.connect_signal("signal::claude_usage", function(five_hour, seven_day, five_hour_resets_at, seven_day_resets_at)
		if five_hour < 0 then
			five_hour_text.markup = helpers.ui.colorize_text("N/A", beautiful.overlay2)
		else
			local val = math.floor(five_hour)
			five_hour_text.markup = helpers.ui.colorize_text(val .. "%", color_for_value(five_hour))
		end

		if seven_day < 0 then
			seven_day_text.markup = helpers.ui.colorize_text("N/A", beautiful.overlay2)
		else
			local val = math.floor(seven_day)
			seven_day_text.markup = helpers.ui.colorize_text(val .. "%", color_for_value(seven_day))
		end

		local peak = math.max(five_hour, seven_day)
		label_text.markup = helpers.ui.colorize_text("CC", color_for_value(peak))

		local now = os.time(os.date("!*t"))
		local lines = {}
		local fh_ts = parse_iso8601(five_hour_resets_at)
		local sd_ts = parse_iso8601(seven_day_resets_at)
		if fh_ts then
			table.insert(lines, "5h resets in " .. format_remaining(fh_ts - now))
		end
		if sd_ts then
			table.insert(lines, "7d resets in " .. format_remaining(sd_ts - now))
		end
		tooltip.text = #lines > 0 and table.concat(lines, "\n") or "N/A"
	end)

	return widget
end
