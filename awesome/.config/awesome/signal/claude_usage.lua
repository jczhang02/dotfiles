local awful = require("awful")
local gears = require("gears")
local json = require("modules.json")

--- Claude Code Usage Signal
--- ~~~~~~~~~~~~~~~~~~~~~~~~
--- Emits: signal::claude_usage(five_hour, seven_day, five_hour_resets_at, seven_day_resets_at)
---   five_hour: number (-1 = error, 0-100 = utilization %)
---   seven_day: number (-1 = error, 0-100 = utilization %)
---   five_hour_resets_at: string (ISO 8601 timestamp or "")
---   seven_day_resets_at: string (ISO 8601 timestamp or "")

local INTERVAL = 120
local SCRIPT = gears.filesystem.get_configuration_dir() .. "utilities/claude-usage"

local function emit_usage()
	awful.spawn.easy_async_with_shell(SCRIPT, function(stdout)
		local five_hour = -1
		local seven_day = -1
		local five_hour_resets_at = ""
		local seven_day_resets_at = ""

		local ok, data = pcall(json.decode, stdout)

		if ok and data then
			five_hour = data.five_hour or -1
			seven_day = data.seven_day or -1
			five_hour_resets_at = data.five_hour_resets_at or ""
			seven_day_resets_at = data.seven_day_resets_at or ""
		end

		awesome.emit_signal("signal::claude_usage", five_hour, seven_day, five_hour_resets_at, seven_day_resets_at)
	end)
end

emit_usage()
gears.timer({
	timeout = INTERVAL,
	autostart = true,
	call_now = false,
	callback = emit_usage,
})

awesome.connect_signal("signal::claude_usage_refresh", emit_usage)
