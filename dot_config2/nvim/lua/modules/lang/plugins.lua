local lang = {}
local conf = require("modules.lang.config")

lang["fatih/vim-go"] = {
	opt = true,
	ft = "go",
	run = ":GoInstallBinaries",
	config = conf.lang_go,
}
lang["rust-lang/rust.vim"] = { opt = true, ft = "rust" }
lang["simrat39/rust-tools.nvim"] = {
	opt = true,
	ft = "rust",
	config = conf.rust_tools,
	requires = { { "nvim-lua/plenary.nvim", opt = false } },
}
-- lang["kristijanhusak/orgmode.nvim"] = {
--     opt = true,
--     ft = "org",
--     config = conf.lang_org
-- }
lang["iamcco/markdown-preview.nvim"] = {
	opt = true,
	ft = "markdown",
	run = "cd app && yarn install",
}
lang["chrisbra/csv.vim"] = { opt = true, ft = "csv" }
lang["lervag/vimtex"] = {
	opt = false,
	-- ft = "tex",
	config = conf.vimtex,
}
lang["dccsillag/magma-nvim"] = {
	opt = true,
	ft = "python",
	run = ":UpdateRemotePlugins",
	config = conf.magma,
}
lang["jalvesaq/Nvim-R"] = {
	opt = true,
	ft = "rmd",
	branch = "stable",
	config = conf.nvimr,
}

return lang
