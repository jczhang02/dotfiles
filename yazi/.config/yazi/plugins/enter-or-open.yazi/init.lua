return {
	entry = function()
		local hovered = cx.active.current.hovered
		ya.emit(hovered and hovered.cha.is_dir and "enter" or "open", {})
	end,
}
