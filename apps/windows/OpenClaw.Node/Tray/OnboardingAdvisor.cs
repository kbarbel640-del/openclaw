using System;
using System.IO;

namespace OpenClaw.Node.Tray
{
    public sealed record OnboardingAssessment(bool Ready, string StatusText, string ActionHint);

    public static class OnboardingAdvisor
    {
        public static OnboardingAssessment Evaluate(string gatewayUrl, string gatewayToken, string configPath)
        {
            if (string.IsNullOrWhiteSpace(gatewayToken))
            {
                return new OnboardingAssessment(false, "Onboarding: Missing token", "Open config and set gateway.auth.token");
            }

            if (!Uri.TryCreate(gatewayUrl, UriKind.Absolute, out var uri) ||
                !(string.Equals(uri.Scheme, "ws", StringComparison.OrdinalIgnoreCase) || string.Equals(uri.Scheme, "wss", StringComparison.OrdinalIgnoreCase)))
            {
                return new OnboardingAssessment(false, "Onboarding: Invalid gateway URL", "Use ws:// or wss:// gateway URL");
            }

            if (!File.Exists(configPath))
            {
                return new OnboardingAssessment(false, "Onboarding: Config file missing", "Open config to create ~/.openclaw/openclaw.json");
            }

            return new OnboardingAssessment(true, "Onboarding: Ready", "No action needed");
        }
    }
}
