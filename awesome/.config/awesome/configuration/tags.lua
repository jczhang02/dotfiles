local awful = require("awful")

--- Tags
--- ~~~~

screen.connect_signal("request::desktop_decoration", function(s)
	--- Each screen has its own tag table.
	if s == screen.primary then
		awful.tag({ "1", "2", "3", "4", "5", "6", "7", "8", "9" }, s, awful.layout.layouts[1])
	else
		awful.tag({ "1", "2", "3", "4", "5", "6", "7", "8", "9" }, s, awful.layout.layouts[1])
	end
end)
