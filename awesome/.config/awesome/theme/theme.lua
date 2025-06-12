--- ░▀█▀░█░█░█▀▀░█▄█░█▀▀
--- ░░█░░█▀█░█▀▀░█░█░█▀▀
--- ░░▀░░▀░▀░▀▀▀░▀░▀░▀▀▀

local gears = require("gears")
local gfs = require("gears.filesystem")
local themes_path = gfs.get_themes_dir()
local theme = dofile(themes_path .. "default/theme.lua")
local theme_assets = require("beautiful.theme_assets")
local xresources = require("beautiful.xresources")
local dpi = xresources.apply_dpi
local helpers = require("helpers")
local icons = require("icons")
local palette = require("modules.catppuccin.latte")

--- ░█▀▀░█▀█░█▀█░▀█▀░█▀▀
--- ░█▀▀░█░█░█░█░░█░░▀▀█
--- ░▀░░░▀▀▀░▀░▀░░▀░░▀▀▀

--- Ui Fonts
theme.font_name = "Iosevka "
theme.font = theme.font_name .. "Medium 9"

--- Icon Fonts
theme.icon_font = "Material Icons "

--- ░█▀▀░█▀█░█░░░█▀█░█▀▄░█▀▀
--- ░█░░░█░█░█░░░█░█░█▀▄░▀▀█
--- ░▀▀▀░▀▀▀░▀▀▀░▀▀▀░▀░▀░▀▀▀

--- Special
theme.white = palette.text.hex
theme.black = palette.base.hex

theme.transparent = "#00000000"

--- catppuccin
theme.base = palette.base.hex
theme.mantle = palette.mantle.hex
theme.crust = palette.crust.hex
theme.surface0 = palette.surface0.hex
theme.surface1 = palette.surface1.hex
theme.surface2 = palette.surface2.hex
theme.overlay0 = palette.overlay0.hex
theme.overlay1 = palette.overlay1.hex
theme.overlay2 = palette.overlay2.hex
theme.subtext0 = palette.subtext0.hex
theme.subtext1 = palette.subtext1.hex
theme.text = palette.text.hex
theme.lavender = palette.lavender.hex
theme.blue = palette.blue.hex
theme.sapphire = palette.sapphire.hex
theme.sky = palette.sky.hex
theme.teal = palette.teal.hex
theme.green = palette.green.hex
theme.yellow = palette.yellow.hex
theme.peach = palette.peach.hex
theme.maroon = palette.maroon.hex
theme.red = palette.red.hex
theme.mauve = palette.mauve.hex
theme.pink = palette.pink.hex
theme.flamingo = palette.flamingo.hex
theme.rosewater = palette.rosewater.hex

--- Background Colors
theme.bg_normal = theme.base
theme.bg_focus = theme.mantle
theme.bg_urgent = theme.base
theme.bg_minimize = theme.base

--- Foreground Colors
theme.fg_normal = theme.text
theme.fg_focus = theme.text
theme.fg_urgent = theme.text
theme.fg_minimize = theme.text

theme.accent = theme.rosewater

--- UI events
theme.leave_event = theme.transparent
theme.enter_event = "#ffffff" .. "10"
theme.press_event = "#ffffff" .. "15"
theme.release_event = "#ffffff" .. "10"

--- Widgets
theme.widget_bg = theme.surface1

--- Titlebars
theme.titlebar_enabled = false
theme.titlebar_bg = theme.base
theme.titlebar_fg = theme.surface1

local icon_dir = gfs.get_configuration_dir() .. "/icons/titlebar/"

-- Close Button
theme.titlebar_close_button_normal = icon_dir .. "normal.svg"
theme.titlebar_close_button_focus = icon_dir .. "close_focus.svg"
theme.titlebar_close_button_normal_hover = icon_dir .. "close_focus_hover.svg"
theme.titlebar_close_button_focus_hover = icon_dir .. "close_focus_hover.svg"

-- Minimize Button
theme.titlebar_minimize_button_normal = icon_dir .. "normal.svg"
theme.titlebar_minimize_button_focus = icon_dir .. "minimize_focus.svg"
theme.titlebar_minimize_button_normal_hover = icon_dir .. "minimize_focus_hover.svg"
theme.titlebar_minimize_button_focus_hover = icon_dir .. "minimize_focus_hover.svg"

-- Maximized Button (While Window is Maximized)
theme.titlebar_maximized_button_normal_active = icon_dir .. "normal.svg"
theme.titlebar_maximized_button_focus_active = icon_dir .. "maximized_focus.svg"
theme.titlebar_maximized_button_normal_active_hover = icon_dir .. "maximized_focus_hover.svg"
theme.titlebar_maximized_button_focus_active_hover = icon_dir .. "maximized_focus_hover.svg"

-- Maximized Button (While Window is not Maximized)
theme.titlebar_maximized_button_normal_inactive = icon_dir .. "normal.svg"
theme.titlebar_maximized_button_focus_inactive = icon_dir .. "maximized_focus.svg"
theme.titlebar_maximized_button_normal_inactive_hover = icon_dir .. "maximized_focus_hover.svg"
theme.titlebar_maximized_button_focus_inactive_hover = icon_dir .. "maximized_focus_hover.svg"

--- Wibar
theme.wibar_bg = theme.surface0
theme.wibar_height = dpi(35)

--- Music
theme.music_bg = theme.base
theme.music_bg_accent = theme.mantle
theme.music_accent = theme.accent

--- ░█░█░▀█▀░░░█▀▀░█░░░█▀▀░█▄█░█▀▀░█▀█░▀█▀░█▀▀
--- ░█░█░░█░░░░█▀▀░█░░░█▀▀░█░█░█▀▀░█░█░░█░░▀▀█
--- ░▀▀▀░▀▀▀░░░▀▀▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀░▀░░▀░░▀▀▀

--- Image Assets
theme.pfp = gears.surface.load_uncached(gfs.get_configuration_dir() .. "theme/assets/pfp.png")
theme.music = gears.surface.load_uncached(gfs.get_configuration_dir() .. "theme/assets/music.png")

--- Layout
--- You can use your own layout icons like this:
theme.layout_floating = icons.floating
theme.layout_max = icons.max
theme.layout_tile = icons.tile
theme.layout_dwindle = icons.dwindle
theme.layout_centered = icons.centered
theme.layout_mstab = icons.mstab
theme.layout_equalarea = icons.equalarea
theme.layout_machi = icons.machi

--- Icon Theme
--- Define the icon theme for application icons. If not set then the icons
--- from /usr/share/icons and /usr/share/icons/hicolor will be used.
--- TODO: find how to reload
theme.icon_theme = "Papirus-Light"

--- Borders
theme.border_width = 4
theme.oof_border_width = 0
theme.border_color_marked = theme.titlebar_bg
theme.border_color_active = theme.rosewater
theme.border_color_normal = theme.transparent
theme.border_color_new = theme.titlebar_bg
theme.border_color_urgent = theme.titlebar_bg
theme.border_color_floating = theme.lavender
theme.border_color_maximized = theme.titlebar_bg
theme.border_color_fullscreen = theme.titlebar_bg
theme.border_focus = theme.text

--- Corner Radius
theme.border_radius = 0

--- Edge snap
theme.snap_bg = theme.base
theme.snap_shape = helpers.ui.rrect(0)

--- Main Menu
theme.main_menu_bg = theme.base

--- Tooltip
theme.tooltip_bg = theme.base
theme.tooltip_fg = theme.text
theme.tooltip_font = theme.font_name .. "Regular 10"

--- Hotkeys Pop Up
theme.hotkeys_bg = theme.base
theme.hotkeys_fg = theme.text
theme.hotkeys_modifiers_fg = theme.base
theme.hotkeys_font = theme.font_name .. "Medium 12"
theme.hotkeys_description_font = theme.font_name .. "Regular 10"
theme.hotkeys_shape = helpers.ui.rrect(theme.border_radius)
theme.hotkeys_group_margin = dpi(50)

--- Tag list
local taglist_square_size = dpi(0)
theme.taglist_squares_sel = theme_assets.taglist_squares_sel(taglist_square_size, theme.fg_normal)
theme.taglist_squares_unsel = theme_assets.taglist_squares_unsel(taglist_square_size, theme.fg_normal)

--- Tag preview
theme.tag_preview_widget_margin = dpi(10)
theme.tag_preview_widget_border_radius = theme.border_radius
theme.tag_preview_client_border_radius = theme.border_radius / 2
theme.tag_preview_client_opacity = 1
theme.tag_preview_client_bg = theme.wibar_bg
theme.tag_preview_client_border_color = theme.wibar_bg
theme.tag_preview_client_border_width = 0
theme.tag_preview_widget_bg = theme.wibar_bg
theme.tag_preview_widget_border_color = theme.wibar_bg
theme.tag_preview_widget_border_width = 0

--- Layout List
theme.layoutlist_shape_selected = helpers.ui.rrect(theme.border_radius)
theme.layoutlist_bg_selected = theme.widget_bg

--- Gaps
theme.useless_gap = dpi(2)

--- Systray
theme.systray_icon_size = dpi(20)
theme.systray_icon_spacing = dpi(10)
theme.bg_systray = theme.wibar_bg
--- theme.systray_max_rows = 2

--- Tabs
theme.mstab_bar_height = dpi(60)
theme.mstab_bar_padding = dpi(0)
theme.mstab_border_radius = dpi(6)
theme.mstab_bar_disable = true
theme.tabbar_disable = true
theme.tabbar_style = "modern"
theme.tabbar_bg_focus = theme.base
theme.tabbar_bg_normal = theme.base
theme.tabbar_fg_focus = theme.crust
theme.tabbar_fg_normal = theme.mantle
theme.tabbar_position = "bottom"
theme.tabbar_AA_radius = 0
theme.tabbar_size = 0
theme.mstab_bar_ontop = true

--- Notifications
theme.notification_spacing = dpi(4)
theme.notification_bg = theme.surface0
theme.notification_bg_alt = theme.surface1
theme.notification_fg = theme.text

--- Swallowing
theme.dont_swallow_classname_list = {
	"firefox",
	"gimp",
	"Google-chrome",
	"Thunar",
}

--- Layout Machi
theme.machi_switcher_border_color = theme.surface1
theme.machi_switcher_border_opacity = 0.25
theme.machi_editor_border_color = theme.surface1
theme.machi_editor_border_opacity = 0.25
theme.machi_editor_active_opacity = 0.25

--- Layout lain
theme.lain_icons = os.getenv("HOME") .. "/.config/awesome/modules/lain/icons/layout/default/"
theme.layout_termfair = theme.lain_icons .. "termfair.png"
theme.layout_centerfair = theme.lain_icons .. "centerfair.png" -- termfair.center
theme.layout_cascade = theme.lain_icons .. "cascade.png"
theme.layout_cascadetile = theme.lain_icons .. "cascadetile.png" -- cascade.tile
theme.layout_centerwork = theme.lain_icons .. "centerwork.png"

return theme
