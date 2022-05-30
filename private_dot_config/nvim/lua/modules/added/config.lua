local config = {}

function config.vimtex()
	vim.cmd([[filetype plugin indent on]])
	vim.cmd([[syntax enable]])
	vim.cmd([[let g:tex_flavor = "latex"]])
	vim.cmd([[let g:vimtex_quickfix_open_on_warning = 0]])
	vim.cmd([[let g:vimtex_compiler_progname = 'nvr']])
	vim.cmd([[let g:vimtex_view_automatic = 1]])
	vim.cmd([[let g:latex_view_general_viewer = 'zathura']])
	vim.cmd([[let g:vimtex_view_method = 'zathura']])
	vim.cmd([[let g:vimtex_format_enabled = 1]])
end

function config.magma()
	vim.cmd([[nnoremap <silent><expr> <Leader>r  :MagmaEvaluateOperator<CR>]])
	vim.cmd([[nnoremap <silent>       <Leader>rr :MagmaEvaluateLine<CR>]])
	vim.cmd([[xnoremap <silent>       <Leader>r  :<C-u>MagmaEvaluateVisual<CR>]])
	vim.cmd([[nnoremap <silent>       <Leader>rc :MagmaReevaluateCell<CR>]])
	vim.cmd([[nnoremap <silent>       <Leader>rd :MagmaDelete<CR>]])
	vim.cmd([[nnoremap <silent>       <Leader>ro :MagmaShowOutput<CR>]])

	vim.cmd([[let g:magma_automatically_open_output = 'false']])
	vim.cmd([[let g:magma_show_mimetype_debug = 'true']])
end

function config.nvimr()
	vim.cmd([[ let R_path = '/opt/R/4.1.3/bin' ]])
end

function config.rosepine()
	require("rose-pine").setup({
		-- @usage 'main'|'moon'
		dark_variant = "moon",
		bold_vert_split = false,
		dim_nc_background = true,
		disable_background = false,
		disable_float_background = false,
		disable_italics = false,
		---@usage string hex value or named color from rosepinetheme.com/palette
		groups = {
			background = "base",
			panel = "surface",
			border = "highlight_med",
			comment = "muted",
			link = "iris",
			punctuation = "subtle",

			error = "love",
			hint = "iris",
			info = "foam",
			warn = "gold",

			headings = {
				h1 = "iris",
				h2 = "foam",
				h3 = "rose",
				h4 = "gold",
				h5 = "pine",
				h6 = "foam",
			},
			-- or set all headings at once
			-- headings = 'subtle'
		},
		-- Change specific vim highlight groups
		highlight_groups = {
			ColorColumn = { bg = "rose" },
		},
	})
end

return config
