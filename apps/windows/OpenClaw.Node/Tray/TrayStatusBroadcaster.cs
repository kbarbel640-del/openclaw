using System;

namespace OpenClaw.Node.Tray
{
    public sealed class TrayStatusBroadcaster
    {
        private readonly Func<DateTimeOffset> _clock;

        public TrayStatusBroadcaster(Func<DateTimeOffset>? clock = null)
        {
            _clock = clock ?? (() => DateTimeOffset.UtcNow);
            Current = new TrayStatusSnapshot(NodeRuntimeState.Starting, "Starting", _clock());
        }

        public TrayStatusSnapshot Current { get; private set; }

        public event Action<TrayStatusSnapshot>? OnStatusChanged;

        public void Set(NodeRuntimeState state, string message)
        {
            if (string.IsNullOrWhiteSpace(message)) message = state.ToString();
            Current = new TrayStatusSnapshot(state, message, _clock());
            OnStatusChanged?.Invoke(Current);
        }
    }
}
