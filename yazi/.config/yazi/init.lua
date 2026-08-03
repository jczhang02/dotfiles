-- Vim-oriented Yazi setup.

require("git"):setup({
	order = 1500,
})

require("relative-motions"):setup({
	show_numbers = "relative_absolute",
	show_motion = true,
	only_motions = false,
	enter_mode = "first",
})

require("smart-enter"):setup({
	open_multi = true,
})
