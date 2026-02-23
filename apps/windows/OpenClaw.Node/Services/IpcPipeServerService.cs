using System;
using System.Collections.Concurrent;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace OpenClaw.Node.Services
{
    public sealed class IpcPipeServerService : IDisposable
    {
        private readonly string _pipeName;
        private readonly string _version;
        private readonly ConcurrentDictionary<int, Task> _clients = new();
        private CancellationTokenSource? _cts;
        private Task? _acceptLoop;
        private int _clientSeq;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false,
        };

        public Action<string>? OnLog { get; set; }

        public IpcPipeServerService(string? pipeName = null, string version = "dev")
        {
            _pipeName = string.IsNullOrWhiteSpace(pipeName) ? "openclaw.node.ipc" : pipeName;
            _version = version;
        }

        public string PipeName => _pipeName;

        public void Start(CancellationToken parentToken)
        {
            if (!OperatingSystem.IsWindows())
            {
                OnLog?.Invoke("[IPC] Named pipe server disabled on non-Windows host.");
                return;
            }

            if (_acceptLoop != null) return;

            _cts = CancellationTokenSource.CreateLinkedTokenSource(parentToken);
            _acceptLoop = Task.Run(() => AcceptLoopAsync(_cts.Token), _cts.Token);
            OnLog?.Invoke($"[IPC] Named pipe server started (\\\\.\\pipe\\{_pipeName}).");
        }

        public async Task StopAsync()
        {
            var cts = _cts;
            if (cts == null) return;

            try { cts.Cancel(); } catch { }

            if (_acceptLoop != null)
            {
                try { await _acceptLoop; } catch { }
            }

            await Task.WhenAll(_clients.Values);

            _acceptLoop = null;
            _cts = null;
            cts.Dispose();
            OnLog?.Invoke("[IPC] Named pipe server stopped.");
        }

        private async Task AcceptLoopAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                NamedPipeServerStream? server = null;
                try
                {
                    server = new NamedPipeServerStream(
                        _pipeName,
                        PipeDirection.InOut,
                        NamedPipeServerStream.MaxAllowedServerInstances,
                        PipeTransmissionMode.Byte,
                        PipeOptions.Asynchronous);

                    await server.WaitForConnectionAsync(ct);

                    var id = Interlocked.Increment(ref _clientSeq);
                    var task = HandleClientAsync(server, id, ct);
                    _clients[id] = task;
                    _ = task.ContinueWith(_ =>
                    {
                        _clients.TryRemove(id, out var _removed);
                    }, TaskScheduler.Default);

                    server = null; // ownership transferred
                }
                catch (OperationCanceledException)
                {
                    server?.Dispose();
                    break;
                }
                catch (Exception ex)
                {
                    server?.Dispose();
                    OnLog?.Invoke($"[IPC] Accept error: {ex.Message}");
                    await Task.Delay(150, ct).ContinueWith(_ => { }, TaskScheduler.Default);
                }
            }
        }

        private async Task HandleClientAsync(NamedPipeServerStream stream, int clientId, CancellationToken ct)
        {
            await using var _ = stream;
            using var reader = new StreamReader(stream, Encoding.UTF8, false, 4096, leaveOpen: true);
            await using var writer = new StreamWriter(stream, new UTF8Encoding(false), 4096, leaveOpen: true)
            {
                AutoFlush = true
            };

            OnLog?.Invoke($"[IPC] Client {clientId} connected.");

            try
            {
                while (!ct.IsCancellationRequested && stream.IsConnected)
                {
                    var line = await reader.ReadLineAsync(ct);
                    if (line == null) break;
                    if (string.IsNullOrWhiteSpace(line)) continue;

                    IpcRequest? req = null;
                    try
                    {
                        req = JsonSerializer.Deserialize<IpcRequest>(line, JsonOptions);
                    }
                    catch
                    {
                        await writer.WriteLineAsync(JsonSerializer.Serialize(new IpcResponse
                        {
                            Id = "",
                            Ok = false,
                            Error = new IpcError { Code = "BAD_JSON", Message = "Invalid JSON request" }
                        }, JsonOptions));
                        continue;
                    }

                    if (req == null || string.IsNullOrWhiteSpace(req.Method))
                    {
                        await writer.WriteLineAsync(JsonSerializer.Serialize(new IpcResponse
                        {
                            Id = req?.Id ?? string.Empty,
                            Ok = false,
                            Error = new IpcError { Code = "BAD_REQUEST", Message = "Missing method" }
                        }, JsonOptions));
                        continue;
                    }

                    var res = await DispatchAsync(req);
                    await writer.WriteLineAsync(JsonSerializer.Serialize(res, JsonOptions));
                }
            }
            catch (OperationCanceledException)
            {
                // normal shutdown
            }
            catch (Exception ex)
            {
                OnLog?.Invoke($"[IPC] Client {clientId} error: {ex.Message}");
            }
            finally
            {
                OnLog?.Invoke($"[IPC] Client {clientId} disconnected.");
            }
        }

        private Task<IpcResponse> DispatchAsync(IpcRequest req)
        {
            var method = req.Method?.Trim() ?? string.Empty;
            if (string.Equals(method, "ipc.ping", StringComparison.OrdinalIgnoreCase))
            {
                var payload = new
                {
                    ok = true,
                    version = _version,
                    nowUtc = DateTimeOffset.UtcNow.ToString("O")
                };
                return Task.FromResult(new IpcResponse
                {
                    Id = req.Id ?? string.Empty,
                    Ok = true,
                    Payload = payload,
                });
            }

            return Task.FromResult(new IpcResponse
            {
                Id = req.Id ?? string.Empty,
                Ok = false,
                Error = new IpcError
                {
                    Code = "METHOD_NOT_FOUND",
                    Message = $"Unknown IPC method: {method}"
                }
            });
        }

        public void Dispose()
        {
            try
            {
                StopAsync().GetAwaiter().GetResult();
            }
            catch
            {
                // ignore dispose path errors
            }
        }

        private sealed class IpcRequest
        {
            public string? Id { get; set; }
            public string? Method { get; set; }
            public JsonElement? Params { get; set; }
        }

        private sealed class IpcResponse
        {
            public string Id { get; set; } = string.Empty;
            public bool Ok { get; set; }
            public object? Payload { get; set; }
            public IpcError? Error { get; set; }
        }

        private sealed class IpcError
        {
            public string Code { get; set; } = string.Empty;
            public string Message { get; set; } = string.Empty;
        }
    }
}
