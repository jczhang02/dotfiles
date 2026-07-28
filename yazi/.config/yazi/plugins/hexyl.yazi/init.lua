local M = {}

local function preview_text(job, text)
	ya.preview_widget(job, ui.Text.parse(text):area(job.area):wrap(ui.Wrap.YES))
end

local function preview_command(job, command, args)
	local child, err = Command(command)
		:arg(args)
		:stdout(Command.PIPED)
		:stderr(Command.PIPED)
		:spawn()

	if not child then
		return preview_text(job, command .. ": " .. tostring(err))
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
		local text = table.concat(outs, ""):gsub("\t", string.rep(" ", rt.preview.tab_size))
		preview_text(job, text)
	end
end

function M:peek(job)
	local bytes_per_line = math.max(8, math.min(32, math.floor((job.area.w - 12) / 4)))
	preview_command(job, "xxd", { "-g", "1", "-c", tostring(bytes_per_line), tostring(job.file.path) })
end

function M:seek(job)
	require("code"):seek(job)
end

return M
