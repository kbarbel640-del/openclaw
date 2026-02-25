--[[
  SophieConnect — Plugin Info Provider

  Provides the plugin's info panel in Lightroom's Plugin Manager.
]]

local LrView = import "LrView"
local LrColor = import "LrColor"

local SophieServer = require "SophieServer"

return {
  sectionsForTopOfDialog = function(viewFactory, propertyTable)
    return {
      {
        title = "SophieConnect",
        viewFactory:row {
          viewFactory:static_text {
            title = "SophieConnect provides a TCP socket interface for Sophie to control Lightroom.",
            fill_horizontal = 1,
            width_in_chars = 40,
            height_in_lines = 2,
          },
        },
        viewFactory:row {
          viewFactory:static_text {
            title = "Status: ",
            font = "<system/bold>",
          },
          viewFactory:static_text {
            title = SophieServer.isRunning() and "Running on port 47290" or "Not running",
            text_color = SophieServer.isRunning() and LrColor(0, 0.6, 0) or LrColor(0.6, 0, 0),
          },
        },
      },
    }
  end,
}
