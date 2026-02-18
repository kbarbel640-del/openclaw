/// WebSocket connection to OpenClaw gateway.
/// Handles auto-reconnect, message routing, and audio streaming.

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../config/zeke_config.dart';

enum GatewayState { disconnected, connecting, connected }

class GatewayService {
  WebSocketChannel? _channel;
  GatewayState _state = GatewayState.disconnected;
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;

  final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  final _stateController = StreamController<GatewayState>.broadcast();

  Stream<Map<String, dynamic>> get messages => _messageController.stream;
  Stream<GatewayState> get stateChanges => _stateController.stream;
  GatewayState get state => _state;

  /// Connect to ZEKE's OpenClaw gateway.
  Future<void> connect({String? pairingToken}) async {
    if (_state == GatewayState.connecting) return;
    _setState(GatewayState.connecting);

    try {
      final uri = Uri.parse('${ZekeConfig.gatewayWss}${ZekeConfig.nodeEndpoint}');
      _channel = WebSocketChannel.connect(uri);

      await _channel!.ready;
      _setState(GatewayState.connected);
      _reconnectAttempts = 0;

      // Send handshake
      _send({
        'type': 'node.hello',
        'name': 'ZEKE-Android',
        'version': ZekeConfig.appVersion,
        if (pairingToken != null) 'token': pairingToken,
      });

      _channel!.stream.listen(
        _onMessage,
        onDone: () => _onDisconnect('Connection closed'),
        onError: (e) => _onDisconnect('Error: $e'),
      );
    } catch (e) {
      _onDisconnect('Connect failed: $e');
    }
  }

  /// Send a text message to ZEKE.
  void sendMessage(String text) {
    _send({'type': 'chat.message', 'text': text, 'timestamp': DateTime.now().toIso8601String()});
  }

  /// Stream an Opus audio frame to the gateway.
  void sendAudioFrame(Uint8List opusFrame) {
    if (_state != GatewayState.connected) return;
    _channel?.sink.add(opusFrame);
  }

  /// Send audio metadata (start/stop streaming signals).
  void sendAudioControl(String action) {
    _send({'type': 'audio.$action', 'timestamp': DateTime.now().toIso8601String()});
  }

  /// Send device context (location, activity, etc).
  void sendContext(Map<String, dynamic> context) {
    _send({'type': 'node.context', ...context});
  }

  void _send(Map<String, dynamic> data) {
    if (_state != GatewayState.connected) return;
    _channel?.sink.add(jsonEncode(data));
  }

  void _onMessage(dynamic raw) {
    try {
      if (raw is String) {
        final data = jsonDecode(raw) as Map<String, dynamic>;
        _messageController.add(data);
      }
    } catch (_) {}
  }

  void _onDisconnect(String reason) {
    _setState(GatewayState.disconnected);
    _channel = null;
    _scheduleReconnect();
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    final delayMs = (ZekeConfig.wsReconnectBaseMs *
            _pow(ZekeConfig.wsReconnectMultiplier, _reconnectAttempts))
        .clamp(ZekeConfig.wsReconnectBaseMs, ZekeConfig.wsReconnectMaxMs)
        .toInt();
    _reconnectAttempts++;

    _reconnectTimer = Timer(Duration(milliseconds: delayMs), () => connect());
  }

  void _setState(GatewayState s) {
    _state = s;
    _stateController.add(s);
  }

  double _pow(double base, int exp) {
    double result = 1.0;
    for (var i = 0; i < exp; i++) {
      result *= base;
    }
    return result;
  }

  void disconnect() {
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    _channel = null;
    _setState(GatewayState.disconnected);
  }

  void dispose() {
    disconnect();
    _messageController.close();
    _stateController.close();
  }
}
