local naughty = require("naughty")
local awful = require("awful")

local shots = {}

function shots.shot(action)
	local cmd
	local timestamp = os.date("%Y.%m.%d-%H.%M.%S")
	local filename = "/home/jc/Pictures/screenshots/" .. timestamp .. ".screenshot.png"

	local open = naughty.action({
		name = "Open",
		icon_only = false,
	})

	local delete = naughty.action({
		name = "Delete",
		icon_only = false,
	})

	local send = naughty.action({
		name = "Send",
		icon_only = false,
	})

	open:connect_signal("invoked", function()
		awful.spawn("feh " .. filename)
	end)

	delete:connect_signal("invoked", function()
		awful.spawn("rm " .. filename)
	end)

	send:connect_signal("invoked", function()
		awful.spawn("kdeconnect-cli --device=6817e90ac81177dc --share=" .. filename)
	end)

	if action == "full" then
		cmd = "scrot -q100 "
			.. filename
			.. " && xclip -selection clipboard -t image/png -i "
			.. filename
			.. " &>/dev/null"
		awful.spawn.easy_async_with_shell(cmd, function(_, __, ___, exit_code)
			if exit_code == 0 then
				naughty.notification({
					app_name = "screenshot",
					icon = filename,
					timeout = 10,
					title = "screensht!",
					message = "Full screenshot saved and copied to clipboard!",
					actions = { open, delete, send },
				})
			end
		end)
	elseif action == "selection" then
		cmd = "scrot -q100 -s -f -b "
			.. filename
			.. "  && xclip -selection clipboard -t image/png -i "
			.. filename
			.. " &>/dev/null"
		awful.spawn.easy_async_with_shell(cmd, function(_, __, ___, exit_code)
			if exit_code == 0 then
				naughty.notification({
					app_name = "screenshot",
					icon = filename,
					timeout = 10,
					title = "screensht!",
					message = "Area screenshot saved and copied to clipboard!",
					actions = { open, delete, send },
				})
			end
		end)
	end
end

return shots
