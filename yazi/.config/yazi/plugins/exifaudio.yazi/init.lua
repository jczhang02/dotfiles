local M = {}

local TAGS = {
	"-q",
	"-q",
	"-S",
	"-Title",
	"-SortName",
	"-TitleSort",
	"-TitleSortOrder",
	"-Artist",
	"-SortArtist",
	"-ArtistSort",
	"-PerformerSortOrder",
	"-Album",
	"-SortAlbum",
	"-AlbumSort",
	"-AlbumSortOrder",
	"-AlbumArtist",
	"-SortAlbumArtist",
	"-AlbumArtistSort",
	"-AlbumArtistSortOrder",
	"-Genre",
	"-TrackNumber",
	"-Year",
	"-Duration",
	"-SampleRate",
	"-AudioSampleRate",
	"-AudioBitrate",
	"-AvgBitrate",
	"-Channels",
	"-AudioChannels",
}

local LABELS = {
	Sortname = "Sort Title",
	SortName = "Sort Title",
	TitleSort = "Sort Title",
	TitleSortOrder = "Sort Title",
	ArtistSort = "Sort Artist",
	SortArtist = "Sort Artist",
	PerformerSortOrder = "Sort Artist",
	SortAlbumArtist = "Sort Album Artist",
	AlbumArtistSortOrder = "Sort Album Artist",
	AlbumArtistSort = "Sort Album Artist",
	AlbumSortOrder = "Sort Album",
	AlbumSort = "Sort Album",
	SortAlbum = "Sort Album",
	TrackNumber = "Track Number",
	AudioBitrate = "Bitrate",
	AvgBitrate = "Average Bitrate",
	AudioSampleRate = "Sample Rate",
	AudioChannels = "Channels",
}

local function preview_text(job, text)
	ya.preview_widget(job, ui.Text.parse(text):area(job.area):wrap(ui.Wrap.YES))
end

local function prettify(line)
	local key, value = line:match("^([^:]+):%s*(.*)$")
	if not key then
		return line
	end
	return string.format("%-18s %s", LABELS[key] or key, value)
end

function M:peek(job)
	local args = {}
	for _, arg in ipairs(TAGS) do
		args[#args + 1] = arg
	end
	args[#args + 1] = tostring(job.file.path)

	local child, err = Command("exiftool")
		:arg(args)
		:stdout(Command.PIPED)
		:stderr(Command.PIPED)
		:spawn()

	if not child then
		return preview_text(job, "exiftool: " .. tostring(err))
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
			outs[#outs + 1] = prettify(next)
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
