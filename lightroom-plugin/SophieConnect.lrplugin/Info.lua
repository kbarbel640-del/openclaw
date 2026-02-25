--[[
  SophieConnect — Lightroom Classic Plugin

  Provides a TCP socket server that Sophie can connect to for
  direct programmatic control of Lightroom Classic.

  This eliminates the need for screenshot-based UI automation
  for slider reading/writing operations.
]]

return {
  LrSdkVersion = 13.0,
  LrSdkMinimumVersion = 10.0,
  LrToolkitIdentifier = "com.deptofvibe.sophie.connect",
  LrPluginName = "SophieConnect",
  LrPluginInfoUrl = "https://deptofvibe.com/sophie",

  LrInitPlugin = "SophieInit.lua",

  LrPluginInfoProvider = "SophieInfoProvider.lua",

  VERSION = { major = 1, minor = 0, revision = 0 },
}
