local M = {}

local PYTHON = [[
import json
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8", errors="replace") as handle:
    text = handle.read()

try:
    data = json.loads(text)
    print(json.dumps(data, ensure_ascii=False, indent=2))
except json.JSONDecodeError:
    for line in text.splitlines():
        if not line.strip():
            continue
        data = json.loads(line)
        print(json.dumps(data, ensure_ascii=False, indent=2))
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
