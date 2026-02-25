--[[
  SophieConnect — TCP Socket Server

  Listens on localhost:47290 for JSON commands from Sophie.

  Supported commands:
    - getValue: Get a single develop setting value
    - setValue: Set a single develop setting value
    - getDevelopSettings: Get all develop settings
    - getSelectedPhotoPath: Get the file path of the selected photo
    - selectNextPhoto: Navigate to the next photo
    - ping: Health check

  Protocol:
    - Client sends a JSON object terminated by newline
    - Server responds with a JSON object terminated by newline
    - One command per connection (connect, send, receive, close)
]]

local LrSocket = import "LrSocket"
local LrTasks = import "LrTasks"
local LrLogger = import "LrLogger"
local LrDevelopController = import "LrDevelopController"
local LrApplication = import "LrApplication"
local LrSelection = import "LrSelection"

local logger = LrLogger("SophieConnect")
logger:enable("logfile")

local SophieServer = {}

local PORT = 47290
local running = false

-- JSON encode/decode (minimal implementation for Lightroom Lua)
local function jsonEncode(obj)
  if type(obj) == "table" then
    -- Check if it's an array
    local isArray = true
    local maxKey = 0
    for k, _ in pairs(obj) do
      if type(k) ~= "number" then
        isArray = false
        break
      end
      if k > maxKey then maxKey = k end
    end
    isArray = isArray and maxKey == #obj

    if isArray then
      local parts = {}
      for _, v in ipairs(obj) do
        parts[#parts + 1] = jsonEncode(v)
      end
      return "[" .. table.concat(parts, ",") .. "]"
    else
      local parts = {}
      for k, v in pairs(obj) do
        parts[#parts + 1] = '"' .. tostring(k) .. '":' .. jsonEncode(v)
      end
      return "{" .. table.concat(parts, ",") .. "}"
    end
  elseif type(obj) == "string" then
    return '"' .. obj:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n') .. '"'
  elseif type(obj) == "number" then
    return tostring(obj)
  elseif type(obj) == "boolean" then
    return obj and "true" or "false"
  elseif obj == nil then
    return "null"
  else
    return '"' .. tostring(obj) .. '"'
  end
end

local function jsonDecode(str)
  -- Simple JSON decoder for command parsing
  -- Uses Lua's load() for basic JSON (numbers, strings, booleans, null, objects, arrays)
  str = str:gsub('"([^"]-)"%s*:', '["%1"]=')
  str = str:gsub('%[%s*%[', '{[')
  str = str:gsub('%]%s*%]', ']}')
  str = str:gsub('^%s*{', 'return {')
  str = str:gsub('null', 'nil')
  str = str:gsub('true', 'true')
  str = str:gsub('false', 'false')

  local fn, err = load(str)
  if fn then
    local ok, result = pcall(fn)
    if ok then
      return result
    end
  end
  return nil
end

-- Command handlers

local function handleGetValue(params)
  local param = params.param
  if not param then
    return { error = "Missing 'param' field" }
  end

  local value = LrDevelopController.getValue(param)
  return { param = param, value = value }
end

local function handleSetValue(params)
  local param = params.param
  local value = params.value
  if not param then
    return { error = "Missing 'param' field" }
  end
  if value == nil then
    return { error = "Missing 'value' field" }
  end

  LrDevelopController.setValue(param, value)

  -- Read back the value to confirm
  local actualValue = LrDevelopController.getValue(param)
  return { param = param, value = actualValue, success = true }
end

local function handleGetDevelopSettings()
  local settings = {}

  -- Core develop parameters
  local params = {
    "Temperature", "Tint",
    "Exposure", "Contrast",
    "Highlights", "Shadows", "Whites", "Blacks",
    "Texture", "Clarity", "Dehaze",
    "Vibrance", "Saturation",
    "ParametricShadows", "ParametricDarks", "ParametricLights", "ParametricHighlights",
    "SharpenAmount", "SharpenRadius", "SharpenDetail", "SharpenEdgeMasking",
    "LuminanceSmoothing", "LuminanceNoiseReductionDetail", "LuminanceNoiseReductionContrast",
    "ColorNoiseReduction", "ColorNoiseReductionDetail", "ColorNoiseReductionSmoothness",
    "SplitToningHighlightHue", "SplitToningHighlightSaturation",
    "SplitToningShadowHue", "SplitToningShadowSaturation",
    "SplitToningBalance",
    "PostCropVignetteAmount", "PostCropVignetteMidpoint",
    "PostCropVignetteFeather", "PostCropVignetteRoundness",
    "PostCropVignetteStyle", "PostCropVignetteHighlightRecovery",
    "GrainAmount", "GrainSize", "GrainFrequency",
  }

  for _, param in ipairs(params) do
    local ok, value = pcall(function()
      return LrDevelopController.getValue(param)
    end)
    if ok then
      settings[param] = value
    end
  end

  return { settings = settings }
end

local function handleGetSelectedPhotoPath()
  local catalog = LrApplication.activeCatalog()
  local photo = catalog:getTargetPhoto()

  if not photo then
    return { error = "No photo selected" }
  end

  local path = photo:getRawMetadata("path")
  local filename = photo:getFormattedMetadata("fileName")

  return { path = path, filename = filename }
end

local function handleSelectNextPhoto()
  LrSelection.nextPhoto()

  -- Wait briefly for LR to update
  LrTasks.sleep(0.2)

  local catalog = LrApplication.activeCatalog()
  local photo = catalog:getTargetPhoto()
  local path = photo and photo:getRawMetadata("path") or nil

  return { success = true, newPath = path }
end

local function handlePing()
  return { status = "ok", plugin = "SophieConnect", version = "1.0.0" }
end

-- Command dispatch

local commandHandlers = {
  getValue = handleGetValue,
  setValue = handleSetValue,
  getDevelopSettings = handleGetDevelopSettings,
  getSelectedPhotoPath = handleGetSelectedPhotoPath,
  selectNextPhoto = handleSelectNextPhoto,
  ping = handlePing,
}

local function processCommand(commandStr)
  local command = jsonDecode(commandStr)
  if not command then
    return jsonEncode({ error = "Invalid JSON" })
  end

  local action = command.action
  if not action then
    return jsonEncode({ error = "Missing 'action' field" })
  end

  local handler = commandHandlers[action]
  if not handler then
    return jsonEncode({ error = "Unknown action: " .. tostring(action) })
  end

  local ok, result = pcall(handler, command)
  if ok then
    result.action = action
    return jsonEncode(result)
  else
    return jsonEncode({ error = tostring(result), action = action })
  end
end

-- Server lifecycle

function SophieServer.start()
  if running then
    logger:info("Server already running")
    return
  end

  running = true
  logger:info("Starting SophieConnect server on port " .. PORT)

  local sender = nil
  local receiver = nil

  -- Create the receiving socket
  receiver = LrSocket.bind {
    functionContext = _G.functionContext or LrTasks.startAsyncTask,
    plugin = _PLUGIN,
    port = PORT,
    mode = "receive",
    onConnecting = function(socket, port)
      logger:info("Client connecting on port " .. port)
    end,
    onMessage = function(socket, message)
      if not message or message == "" then
        return
      end

      logger:trace("Received: " .. message)

      local response = processCommand(message)

      logger:trace("Sending: " .. response)

      if sender then
        sender:send(response .. "\n")
      end
    end,
    onClosed = function(socket)
      logger:info("Receiver socket closed")
    end,
    onError = function(socket, err)
      logger:error("Receiver error: " .. tostring(err))
    end,
  }

  -- Create the sending socket
  sender = LrSocket.bind {
    functionContext = _G.functionContext or LrTasks.startAsyncTask,
    plugin = _PLUGIN,
    port = PORT + 1,
    mode = "send",
    onConnecting = function(socket, port)
      logger:info("Sender connecting on port " .. (PORT + 1))
    end,
    onClosed = function(socket)
      logger:info("Sender socket closed")
    end,
    onError = function(socket, err)
      logger:error("Sender error: " .. tostring(err))
    end,
  }

  logger:info("SophieConnect server started on port " .. PORT)
end

function SophieServer.stop()
  running = false
  logger:info("SophieConnect server stopped")
end

function SophieServer.isRunning()
  return running
end

return SophieServer
