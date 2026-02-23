using System;

namespace OpenClaw.Node.Tray
{
    public sealed record TrayStatusSnapshot(NodeRuntimeState State, string Message, DateTimeOffset UpdatedAtUtc);
}
