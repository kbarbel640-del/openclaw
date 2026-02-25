--[[
  SophieConnect — Plugin Initialization

  Sets up the TCP socket server when the plugin loads.
  The server runs in a background task so it doesn't block Lightroom.
]]

local LrTasks = import "LrTasks"
local LrLogger = import "LrLogger"

local logger = LrLogger("SophieConnect")
logger:enable("logfile")

-- Load the server module
local SophieServer = require "SophieServer"

-- Start the server in a background task
LrTasks.startAsyncTask(function()
  logger:info("SophieConnect plugin initializing...")

  local success, err = pcall(function()
    SophieServer.start()
  end)

  if not success then
    logger:error("Failed to start SophieConnect server: " .. tostring(err))
  end
end)
