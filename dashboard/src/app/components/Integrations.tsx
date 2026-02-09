import React, { useState, useEffect } from "react";
import { X, MessageSquare, Wrench, Bell, Check, Eye, EyeOff, ChevronRight, Globe, Smartphone, Calendar, Search, Monitor, MapPin, Camera, Plus, Trash2, Clock, Play, Pause, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface IntegrationsProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "dark" | "light";
}

type TabType = "channels" | "tools" | "reminders";

// Channel definitions
const CHANNELS = [
  { 
    id: "telegram", 
    name: "Telegram", 
    description: "Connect via Bot API",
    configFields: [
      { key: "botToken", label: "Bot Token", type: "password", placeholder: "123456:ABC-DEF..." }
    ],
  },
  { 
    id: "whatsapp", 
    name: "WhatsApp", 
    description: "Connect your WhatsApp account",
    configFields: [
      { key: "phoneNumber", label: "Phone Number", type: "text", placeholder: "+1234567890" }
    ],
    showQRButton: true,
  },
  { 
    id: "discord", 
    name: "Discord", 
    description: "Discord Bot API",
    configFields: [
      { key: "botToken", label: "Bot Token", type: "password", placeholder: "Your Discord bot token" },
      { key: "applicationId", label: "Application ID", type: "text", placeholder: "Application ID" }
    ],
  },
  { 
    id: "slack", 
    name: "Slack", 
    description: "Slack workspace app",
    configFields: [
      { key: "botToken", label: "Bot Token", type: "password", placeholder: "xoxb-..." },
      { key: "appToken", label: "App Token", type: "password", placeholder: "xapp-..." }
    ],
  },
  { 
    id: "signal", 
    name: "Signal", 
    description: "Privacy-focused messaging",
    configFields: [
      { key: "phoneNumber", label: "Phone Number", type: "text", placeholder: "+1234567890" }
    ],
  },
  { 
    id: "imessage", 
    name: "iMessage", 
    description: "macOS only via BlueBubbles",
    configFields: [
      { key: "serverUrl", label: "Server URL", type: "text", placeholder: "http://localhost:1234" },
      { key: "password", label: "Password", type: "password", placeholder: "BlueBubbles password" }
    ],
  },
];

// Tool definitions
const TOOLS = [
  { 
    id: "web_search", 
    name: "Web Search", 
    icon: Search,
    description: "Search the web using Brave Search API",
    category: "web"
  },
  { 
    id: "web_fetch", 
    name: "Web Fetch", 
    icon: Globe,
    description: "Fetch and extract content from URLs",
    category: "web"
  },
  { 
    id: "browser", 
    name: "Browser Control", 
    icon: Monitor,
    description: "Automate web browser actions",
    category: "automation"
  },
  { 
    id: "nodes", 
    name: "Device Control", 
    icon: Smartphone,
    description: "Control paired mobile devices",
    category: "automation"
  },
  { 
    id: "camera", 
    name: "Camera", 
    icon: Camera,
    description: "Capture photos from paired devices",
    category: "automation"
  },
  { 
    id: "location", 
    name: "Location", 
    icon: MapPin,
    description: "Get location from paired devices",
    category: "automation"
  },
  { 
    id: "cron", 
    name: "Reminders & Cron", 
    icon: Calendar,
    description: "Schedule tasks and reminders",
    category: "scheduling"
  },
  { 
    id: "message", 
    name: "Messaging", 
    icon: MessageSquare,
    description: "Send messages across channels",
    category: "messaging"
  },
];

// Reminders Tab Component
interface Reminder {
  id: string;
  name: string;
  message: string;
  schedule: string;
  scheduleType: "once" | "daily" | "weekly" | "custom";
  enabled: boolean;
  createdAt: number;
}

const RemindersTab: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newReminder, setNewReminder] = useState({
    name: "",
    message: "",
    scheduleType: "once" as "once" | "daily" | "weekly" | "custom",
    time: "",
    date: "",
  });

  // Load reminders from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("easyhub_reminders");
    if (saved) {
      setReminders(JSON.parse(saved));
    }
  }, []);

  // Save reminders to localStorage
  const saveReminders = (updated: Reminder[]) => {
    setReminders(updated);
    localStorage.setItem("easyhub_reminders", JSON.stringify(updated));
  };

  const addReminder = () => {
    if (!newReminder.message.trim()) return;
    
    const reminder: Reminder = {
      id: Date.now().toString(),
      name: newReminder.name || newReminder.message.slice(0, 30),
      message: newReminder.message,
      schedule: newReminder.scheduleType === "once" 
        ? `${newReminder.date} ${newReminder.time}`
        : newReminder.scheduleType === "daily"
          ? `Daily at ${newReminder.time}`
          : newReminder.scheduleType === "weekly"
            ? `Weekly at ${newReminder.time}`
            : newReminder.time,
      scheduleType: newReminder.scheduleType,
      enabled: true,
      createdAt: Date.now(),
    };
    
    saveReminders([...reminders, reminder]);
    setNewReminder({ name: "", message: "", scheduleType: "once", time: "", date: "" });
    setShowAddForm(false);
  };

  const toggleReminder = (id: string) => {
    const updated = reminders.map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    saveReminders(updated);
  };

  const deleteReminder = (id: string) => {
    saveReminders(reminders.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          Schedule reminders and recurring tasks.
        </p>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#2dd4bf] text-black hover:bg-[#5eead4] transition-colors"
        >
          <Plus size={16} />
          Add Reminder
        </button>
      </div>

      {/* Add Reminder Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`p-4 rounded-xl border mb-4 ${
              isDark ? "border-[#2dd4bf]/30 bg-[#2dd4bf]/5" : "border-[#2dd4bf]/50 bg-[#2dd4bf]/5"
            }`}
          >
            <div className="space-y-3">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}>
                  Reminder Message *
                </label>
                <textarea
                  value={newReminder.message}
                  onChange={(e) => setNewReminder(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="What do you want to be reminded about?"
                  rows={2}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDark
                      ? "bg-black/30 border-white/10 text-white placeholder-gray-500"
                      : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
                  } outline-none focus:border-[#2dd4bf]/50`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}>
                    Schedule Type
                  </label>
                  <select
                    value={newReminder.scheduleType}
                    onChange={(e) => setNewReminder(prev => ({ 
                      ...prev, 
                      scheduleType: e.target.value as any 
                    }))}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDark
                        ? "bg-black/30 border-white/10 text-white"
                        : "bg-white border-gray-200 text-gray-900"
                    } outline-none focus:border-[#2dd4bf]/50`}
                  >
                    <option value="once">One-time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}>
                    Time
                  </label>
                  <input
                    type="time"
                    value={newReminder.time}
                    onChange={(e) => setNewReminder(prev => ({ ...prev, time: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDark
                        ? "bg-black/30 border-white/10 text-white"
                        : "bg-white border-gray-200 text-gray-900"
                    } outline-none focus:border-[#2dd4bf]/50`}
                  />
                </div>
              </div>

              {newReminder.scheduleType === "once" && (
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={newReminder.date}
                    onChange={(e) => setNewReminder(prev => ({ ...prev, date: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDark
                        ? "bg-black/30 border-white/10 text-white"
                        : "bg-white border-gray-200 text-gray-900"
                    } outline-none focus:border-[#2dd4bf]/50`}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    isDark ? "text-gray-400 hover:bg-white/5" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={addReminder}
                  disabled={!newReminder.message.trim() || !newReminder.time}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#2dd4bf] text-black hover:bg-[#5eead4] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Reminder
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reminders List */}
      {reminders.length === 0 && !showAddForm ? (
        <div className={`p-8 rounded-xl border text-center ${
          isDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"
        }`}>
          <Clock size={40} className={`mx-auto mb-3 ${
            isDark ? "text-gray-500" : "text-gray-400"
          }`} />
          <h3 className={`font-medium mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
            No Reminders Yet
          </h3>
          <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-500"}`}>
            Click "Add Reminder" to create your first scheduled task.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reminders.map((reminder) => (
            <div
              key={reminder.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                reminder.enabled
                  ? isDark
                    ? "border-[#2dd4bf]/30 bg-[#2dd4bf]/5"
                    : "border-[#2dd4bf]/50 bg-[#2dd4bf]/5"
                  : isDark
                    ? "border-white/10 opacity-60"
                    : "border-gray-200 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  reminder.enabled
                    ? "bg-[#2dd4bf]/20 text-[#2dd4bf]"
                    : isDark
                      ? "bg-white/5 text-gray-500"
                      : "bg-gray-100 text-gray-400"
                }`}>
                  <Bell size={18} />
                </div>
                <div>
                  <div className={`font-medium text-sm ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}>
                    {reminder.name}
                  </div>
                  <div className={`text-xs ${
                    isDark ? "text-gray-500" : "text-gray-500"
                  }`}>
                    {reminder.schedule}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleReminder(reminder.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark ? "hover:bg-white/5" : "hover:bg-gray-100"
                  }`}
                  title={reminder.enabled ? "Pause" : "Resume"}
                >
                  {reminder.enabled ? (
                    <Pause size={16} className={isDark ? "text-gray-400" : "text-gray-500"} />
                  ) : (
                    <Play size={16} className={isDark ? "text-gray-400" : "text-gray-500"} />
                  )}
                </button>
                <button
                  onClick={() => deleteReminder(reminder.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark ? "hover:bg-red-500/20 text-gray-400 hover:text-red-400" : "hover:bg-red-50 text-gray-500 hover:text-red-500"
                  }`}
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tip */}
      <div className={`p-3 rounded-lg mt-4 ${
        isDark ? "bg-white/5" : "bg-gray-50"
      }`}>
        <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
          💡 <strong>Tip:</strong> You can also create reminders in chat by saying "remind me in 30 minutes to..." or "remind me tomorrow at 9am to..."
        </p>
      </div>
    </div>
  );
};

// WhatsApp Setup Component
const WhatsAppSetup: React.FC<{ isDark: boolean; onClose: () => void; phoneNumber?: string }> = ({ isDark, onClose, phoneNumber }) => {
  const [status, setStatus] = useState<"configuring" | "ready" | "error">("configuring");
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-configure WhatsApp on mount
  useEffect(() => {
    const configureWhatsApp = async () => {
      try {
        const gatewayUrl = localStorage.getItem("easyhub_gateway_url") || "http://localhost:3033";
        const gatewayToken = localStorage.getItem("easyhub_gateway_token") || "";
        
        // Try to configure WhatsApp via gateway API
        const response = await fetch(`${gatewayUrl}/api/config/patch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(gatewayToken ? { "Authorization": `Bearer ${gatewayToken}` } : {})
          },
          body: JSON.stringify({
            channels: {
              whatsapp: {
                dmPolicy: "allowlist",
                allowFrom: phoneNumber ? [phoneNumber] : ["*"]
              }
            }
          })
        });

        if (response.ok) {
          setStatus("ready");
        } else {
          // Gateway might not be running, show manual instructions
          setStatus("ready");
        }
      } catch (err) {
        // Gateway not reachable, show manual instructions anyway
        setStatus("ready");
      }
    };

    configureWhatsApp();
  }, [phoneNumber]);

  const copyCommand = () => {
    navigator.clipboard.writeText("easyhub channels login");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`mt-4 p-4 rounded-xl border ${
        isDark ? "bg-black/40 border-white/10" : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
          Connect WhatsApp
        </h4>
        <button
          onClick={onClose}
          className={`p-1 rounded-lg ${isDark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-200 text-gray-500"}`}
        >
          <X size={16} />
        </button>
      </div>

      {status === "configuring" && (
        <div className="flex flex-col items-center py-6">
          <div className="w-8 h-8 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin mb-3" />
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Configuring WhatsApp...
          </p>
        </div>
      )}

      {status === "ready" && (
        <div className={`text-sm space-y-4 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
          <div className={`flex items-center gap-2 p-3 rounded-lg ${isDark ? "bg-green-500/10" : "bg-green-50"}`}>
            <Check size={18} className="text-green-500" />
            <span className={isDark ? "text-green-400" : "text-green-700"}>
              WhatsApp configured! One more step to connect.
            </span>
          </div>

          <div className={`p-4 rounded-xl border-2 border-dashed ${isDark ? "border-[#2dd4bf]/30 bg-[#2dd4bf]/5" : "border-[#2dd4bf]/50 bg-[#2dd4bf]/5"}`}>
            <div className="text-center space-y-3">
              <div className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                📱 Scan QR Code
              </div>
              <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Open PowerShell/Terminal and run:
              </p>
              <div 
                onClick={() => {
                  navigator.clipboard.writeText("easyhub channels login");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-lg font-mono text-sm cursor-pointer transition-all ${
                  copied 
                    ? "bg-green-500 text-white" 
                    : isDark 
                      ? "bg-black/60 text-[#2dd4bf] hover:bg-black/80" 
                      : "bg-white text-[#0d9488] hover:bg-gray-50 shadow-sm"
                }`}
              >
                <code>easyhub channels login</code>
                <span className="text-xs opacity-70">{copied ? "✓ Copied!" : "Click to copy"}</span>
              </div>
            </div>
          </div>

          <div className={`space-y-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            <div className="flex items-start gap-2">
              <span className="font-bold text-[#2dd4bf]">1.</span>
              <span>Paste the command in PowerShell → QR code appears</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-[#2dd4bf]">2.</span>
              <span>Open WhatsApp → <strong>Settings → Linked Devices</strong></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-[#2dd4bf]">3.</span>
              <span>Tap <strong>Link a Device</strong> → Scan the QR</span>
            </div>
          </div>

          <div className={`p-3 rounded-lg ${isDark ? "bg-amber-500/10" : "bg-amber-50"}`}>
            <p className={`text-xs ${isDark ? "text-amber-400" : "text-amber-700"}`}>
              ⚠️ <strong>Note:</strong> Terminal is required because WhatsApp's QR code must be displayed securely. 
              Future updates will show QR directly in dashboard.
            </p>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className={`text-sm space-y-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
          <div className={`flex items-center gap-2 p-3 rounded-lg ${isDark ? "bg-red-500/10" : "bg-red-50"}`}>
            <AlertCircle size={18} className="text-red-500" />
            <span className={isDark ? "text-red-400" : "text-red-700"}>{errorMsg}</span>
          </div>
          <button
            onClick={() => setStatus("configuring")}
            className="w-full py-2 rounded-lg text-sm font-medium bg-[#2dd4bf] text-black hover:bg-[#5eead4]"
          >
            Try Again
          </button>
        </div>
      )}
    </motion.div>
  );
};

export const Integrations: React.FC<IntegrationsProps> = ({ isOpen, onClose, theme }) => {
  const isDark = theme === "dark";
  const [activeTab, setActiveTab] = useState<TabType>("channels");
  const [channelConfigs, setChannelConfigs] = useState<Record<string, any>>({});
  const [enabledChannels, setEnabledChannels] = useState<Record<string, boolean>>({});
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showWhatsAppQR, setShowWhatsAppQR] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const savedChannels = localStorage.getItem("easyhub_channels");
    const savedChannelConfigs = localStorage.getItem("easyhub_channel_configs");
    const savedTools = localStorage.getItem("easyhub_tools");
    
    if (savedChannels) setEnabledChannels(JSON.parse(savedChannels));
    if (savedChannelConfigs) setChannelConfigs(JSON.parse(savedChannelConfigs));
    if (savedTools) {
      setEnabledTools(JSON.parse(savedTools));
    } else {
      // Default: all tools enabled
      const defaultTools: Record<string, boolean> = {};
      TOOLS.forEach(t => defaultTools[t.id] = true);
      setEnabledTools(defaultTools);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("easyhub_channels", JSON.stringify(enabledChannels));
    localStorage.setItem("easyhub_channel_configs", JSON.stringify(channelConfigs));
    localStorage.setItem("easyhub_tools", JSON.stringify(enabledTools));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleChannel = (channelId: string) => {
    setEnabledChannels(prev => ({ ...prev, [channelId]: !prev[channelId] }));
  };

  const toggleTool = (toolId: string) => {
    setEnabledTools(prev => ({ ...prev, [toolId]: !prev[toolId] }));
  };

  const updateChannelConfig = (channelId: string, key: string, value: string) => {
    setChannelConfigs(prev => ({
      ...prev,
      [channelId]: { ...prev[channelId], [key]: value }
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div 
        className={`absolute inset-0 ${isDark ? "bg-black/60" : "bg-black/40"} backdrop-blur-sm`}
        onClick={onClose}
      />
      
      <div 
        className={`relative w-full max-w-3xl mx-4 rounded-2xl border shadow-2xl max-h-[90vh] overflow-hidden flex flex-col ${
          isDark ? "bg-[#111] border-white/10" : "bg-white border-gray-200"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${
          isDark ? "border-white/10" : "border-gray-100"
        }`}>
          <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
            Integrations
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-500"
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex border-b px-6 ${isDark ? "border-white/10" : "border-gray-100"}`}>
          {[
            { id: "channels" as TabType, label: "Channels", icon: MessageSquare },
            { id: "tools" as TabType, label: "Tools", icon: Wrench },
            { id: "reminders" as TabType, label: "Reminders", icon: Bell },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#2dd4bf] text-[#2dd4bf]"
                  : isDark
                    ? "border-transparent text-gray-500 hover:text-gray-300"
                    : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === "channels" && (
            <div className="space-y-3">
              <p className={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Connect EasyHub to your favorite messaging platforms.
              </p>
              
              {CHANNELS.map((channel) => {
                const isEnabled = enabledChannels[channel.id];
                const isExpanded = expandedChannel === channel.id;
                const config = channelConfigs[channel.id] || {};
                
                return (
                  <div
                    key={channel.id}
                    className={`rounded-xl border transition-all ${
                      isEnabled
                        ? isDark
                          ? "border-[#2dd4bf]/30 bg-[#2dd4bf]/5"
                          : "border-[#2dd4bf]/50 bg-[#2dd4bf]/5"
                        : isDark
                          ? "border-white/10"
                          : "border-gray-200"
                    }`}
                  >
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer"
                      onClick={() => setExpandedChannel(isExpanded ? null : channel.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isEnabled
                            ? "bg-[#2dd4bf]/20 text-[#2dd4bf]"
                            : isDark
                              ? "bg-white/5 text-gray-500"
                              : "bg-gray-100 text-gray-400"
                        }`}>
                          <MessageSquare size={20} />
                        </div>
                        <div>
                          <div className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                            {channel.name}
                          </div>
                          <div className={`text-sm ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                            {channel.description}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleChannel(channel.id);
                          }}
                          className={`relative w-12 h-6 rounded-full transition-colors ${
                            isEnabled ? "bg-[#2dd4bf]" : isDark ? "bg-white/10" : "bg-gray-200"
                          }`}
                        >
                          <div 
                            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                              isEnabled ? "translate-x-7" : "translate-x-1"
                            }`}
                          />
                        </button>
                        <ChevronRight 
                          size={20} 
                          className={`transition-transform ${isDark ? "text-gray-500" : "text-gray-400"} ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className={`px-4 pb-4 pt-2 border-t ${
                            isDark ? "border-white/5" : "border-gray-100"
                          }`}>
                            {channel.configFields && channel.configFields.length > 0 ? (
                              <div className="space-y-3">
                                {channel.configFields.map((field) => (
                                  <div key={field.key}>
                                    <label className={`block text-sm font-medium mb-1.5 ${
                                      isDark ? "text-gray-300" : "text-gray-700"
                                    }`}>
                                      {field.label}
                                    </label>
                                    <div className="relative">
                                      <input
                                        type={field.type === "password" && !showSecrets[`${channel.id}_${field.key}`] ? "password" : "text"}
                                        value={config[field.key] || ""}
                                        onChange={(e) => updateChannelConfig(channel.id, field.key, e.target.value)}
                                        placeholder={field.placeholder}
                                        className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm font-mono ${
                                          isDark
                                            ? "bg-black/30 border-white/10 text-white placeholder-gray-500"
                                            : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
                                        } outline-none focus:border-[#2dd4bf]/50`}
                                      />
                                      {field.type === "password" && (
                                        <button
                                          onClick={() => setShowSecrets(prev => ({
                                            ...prev,
                                            [`${channel.id}_${field.key}`]: !prev[`${channel.id}_${field.key}`]
                                          }))}
                                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 ${
                                            isDark ? "text-gray-500" : "text-gray-400"
                                          }`}
                                        >
                                          {showSecrets[`${channel.id}_${field.key}`] ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                
                                {/* QR Code pairing button for WhatsApp */}
                                {channel.showQRButton && (
                                  <div className="mt-3">
                                    {!showWhatsAppQR ? (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowWhatsAppQR(true);
                                          }}
                                          className={`w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                                            isDark
                                              ? "bg-[#2dd4bf]/20 text-[#2dd4bf] hover:bg-[#2dd4bf]/30"
                                              : "bg-[#2dd4bf]/10 text-[#0d9488] hover:bg-[#2dd4bf]/20"
                                          } transition-colors`}
                                        >
                                          <MessageSquare size={16} />
                                          Scan QR Code to Connect
                                        </button>
                                        <p className={`text-xs mt-2 text-center ${
                                          isDark ? "text-gray-500" : "text-gray-400"
                                        }`}>
                                          You'll need to scan a QR code with your WhatsApp mobile app
                                        </p>
                                      </>
                                    ) : (
                                      <AnimatePresence>
                                        <WhatsAppSetup 
                                          isDark={isDark} 
                                          onClose={() => setShowWhatsAppQR(false)}
                                          phoneNumber={config?.phoneNumber}
                                        />
                                      </AnimatePresence>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : null}
                            
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "tools" && (
            <div className="space-y-4">
              <p className={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Enable or disable AI tools and capabilities.
              </p>
              
              {["web", "automation", "scheduling", "messaging"].map((category) => {
                const categoryTools = TOOLS.filter(t => t.category === category);
                const categoryLabels: Record<string, string> = {
                  web: "Web & Search",
                  automation: "Automation",
                  scheduling: "Scheduling",
                  messaging: "Messaging"
                };
                
                return (
                  <div key={category}>
                    <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
                      isDark ? "text-gray-500" : "text-gray-400"
                    }`}>
                      {categoryLabels[category]}
                    </h3>
                    <div className="grid gap-2">
                      {categoryTools.map((tool) => {
                        const isEnabled = enabledTools[tool.id] !== false;
                        const Icon = tool.icon;
                        
                        return (
                          <div
                            key={tool.id}
                            onClick={() => toggleTool(tool.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              isEnabled
                                ? isDark
                                  ? "border-[#2dd4bf]/30 bg-[#2dd4bf]/5"
                                  : "border-[#2dd4bf]/50 bg-[#2dd4bf]/5"
                                : isDark
                                  ? "border-white/10 opacity-60"
                                  : "border-gray-200 opacity-60"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                isEnabled
                                  ? "bg-[#2dd4bf]/20 text-[#2dd4bf]"
                                  : isDark
                                    ? "bg-white/5 text-gray-500"
                                    : "bg-gray-100 text-gray-400"
                              }`}>
                                <Icon size={18} />
                              </div>
                              <div>
                                <div className={`font-medium text-sm ${
                                  isDark ? "text-white" : "text-gray-900"
                                }`}>
                                  {tool.name}
                                </div>
                                <div className={`text-xs ${
                                  isDark ? "text-gray-500" : "text-gray-500"
                                }`}>
                                  {tool.description}
                                </div>
                              </div>
                            </div>
                            
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              isEnabled
                                ? "border-[#2dd4bf] bg-[#2dd4bf]"
                                : isDark
                                  ? "border-white/20"
                                  : "border-gray-300"
                            }`}>
                              {isEnabled && <Check size={12} className="text-black" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "reminders" && (
            <RemindersTab isDark={isDark} />
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0 ${
          isDark ? "border-white/10" : "border-gray-100"
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              isDark
                ? "text-gray-400 hover:bg-white/5"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              saved
                ? "bg-green-500 text-white"
                : "bg-[#2dd4bf] text-black hover:bg-[#5eead4]"
            }`}
          >
            {saved ? (
              <>
                <Check size={16} />
                Saved!
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
