local M = {}

local PYTHON = [[
import csv
import sys
from itertools import islice

path = sys.argv[1]
with open(path, newline="", errors="replace") as handle:
    rows = list(islice(csv.reader(handle), 2000))

if not rows:
    raise SystemExit

cols = max(len(row) for row in rows)
widths = []
for idx in range(cols):
    width = max((len(row[idx]) if idx < len(row) else 0) for row in rows)
    widths.append(min(width, 40))

for row in rows:
    cells = []
    for idx, width in enumerate(widths):
        value = row[idx] if idx < len(row) else ""
        if len(value) > width:
            value = value[: max(0, width - 1)] + "…"
        cells.append(value.ljust(width))
    print("  ".join(cells).rstrip())
]]

local function preview_text(job, text)
	ya.preview_widget(job, ui.Text.parse(text):area(job.area):wrap(ui.Wrap.YES))
end

function M:peek(job)
	local child, err = Command("python3")
		:arg({ "-c", PYTHON, tostring(job.file.path) })
		:stdout(Command.PIPED)
		:stderr(Command.PIPED)
		:spawn()

	if not child then
		return preview_text(job, "python3: " .. tostring(err))
	end

	local limit = job.area.h
	local i, outs, errs = 0, {}, {}
	repeat
		local next, event = child:read_line()
		if event == 1 then
			errs[#errs + 1] = next
		elseif event ~= 0 then
			break
		end

		i = i + 1
		if i > job.skip then
			outs[#outs + 1] = next
		end
	until i >= job.skip + limit

	child:start_kill()
	if #errs > 0 then
		preview_text(job, table.concat(errs, ""))
	elseif job.skip > 0 and i < job.skip + limit then
		ya.emit("peek", { math.max(0, i - limit), only_if = job.file.url, upper_bound = true })
	else
		preview_text(job, table.concat(outs, ""))
	end
end

function M:seek(job)
	require("code"):seek(job)
end

return M
