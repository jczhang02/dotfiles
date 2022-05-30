local added = {}
local conf = require("modules.added.config")

added["h-hg/fcitx.nvim"] = {
	opt = false,
}
added["numToStr/Navigator.nvim"] = {
	config = function()
		require("Navigator").setup()
		vim.keymap.set("n", "<C-h>", "<CMD>NavigatorLeft<CR>")
		vim.keymap.set("n", "<C-l>", "<CMD>NavigatorRight<CR>")
		vim.keymap.set("n", "<C-k>", "<CMD>NavigatorUp<CR>")
		vim.keymap.set("n", "<C-j>", "<CMD>NavigatorDown<CR>")
	end,
}
added["askfiy/nvim-picgo"] = {
	opt = true,
	ft = "markdown",
	config = function()
		require("nvim-picgo").setup()
	end,
}
added["sbdchd/neoformat"] = {
	opt = true,
	ft = { "R", "tex", "matlab" },
}

added["lervag/vimtex"] = {
	opt = false,
	-- ft = "tex",
	config = conf.vimtex,
}
added["dccsillag/magma-nvim"] = {
	opt = true,
	ft = "python",
	run = ":UpdateRemotePlugins",
	config = conf.magma,
}
added["jalvesaq/Nvim-R"] = {
	opt = true,
	ft = "rmd",
	branch = "stable",
	config = conf.nvimr,
}
added["rose-pine/neovim"] = {
	opt = false,
	as = "rose-pine",
	tag = "v1.*",
	config = conf.rosepine,
}

added["zbirenbaum/copilot.lua"] = {
	event = { "VimEnter" },
	config = function()
		vim.defer_fn(function()
			require("copilot").setup()
		end, 100)
	end,
}
added["chipsenkbeil/distant.nvim"] = {
	opt = false,
	config = function()
		require("distant").setup({
			-- Applies Chip's personal settings to every machine you connect to
			--
			-- 1. Ensures that distant servers terminate with no connections
			-- 2. Provides navigation bindings for remote directories
			-- 3. Provides keybinding to jump into a remote file's parent directory
			["*"] = require("distant.settings").chip_default(),
		})
	end,
}

added["MortenStabenau/matlab-vim"] = {
	opt = true,
	ft = "matlab",
	config = function()
		vim.cmd([[let g:matlab_executable = '/usr/bin/matlab']])
		vim.cmd([[let g:matlab_panel_size = 50]])
		vim.cmd([[let g:matlab_auto_start = 0]])
	end,
}

return added
