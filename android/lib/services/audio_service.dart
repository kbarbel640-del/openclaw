/// Audio pipeline — pendant Opus frames OR phone mic → gateway stream.

import 'dart:async';
import 'dart:typed_data';
import 'package:record/record.dart';
import 'gateway_service.dart';
import 'limitless_service.dart';

enum AudioSource { pendant, microphone, none }

class AudioService {
  final GatewayService _gateway;
  final LimitlessService _limitless;
  final AudioRecorder _recorder = AudioRecorder();

  StreamSubscription? _pendantSub;
  StreamSubscription? _micSub;
  AudioSource _activeSource = AudioSource.none;

  int _framesSent = 0;
  int get framesSent => _framesSent;
  AudioSource get activeSource => _activeSource;

  AudioService(this._gateway, this._limitless);

  /// Start streaming from pendant audio.
  void startPendantStream() {
    stopAll();
    _activeSource = AudioSource.pendant;
    _gateway.sendAudioControl('start');

    _pendantSub = _limitless.audioFrames.listen((frame) {
      _gateway.sendAudioFrame(frame);
      _framesSent++;
    });
  }

  /// Fallback: stream from phone microphone.
  Future<void> startMicStream() async {
    stopAll();
    _activeSource = AudioSource.microphone;
    _gateway.sendAudioControl('start');

    if (await _recorder.hasPermission()) {
      final stream = await _recorder.startStream(const RecordConfig(
        encoder: AudioEncoder.opus,
        sampleRate: 16000,
        numChannels: 1,
        bitRate: 24000,
      ));

      _micSub = stream.listen((data) {
        _gateway.sendAudioFrame(Uint8List.fromList(data));
        _framesSent++;
      });
    }
  }

  void stopAll() {
    _pendantSub?.cancel();
    _micSub?.cancel();
    _recorder.stop();
    if (_activeSource != AudioSource.none) {
      _gateway.sendAudioControl('stop');
    }
    _activeSource = AudioSource.none;
    _framesSent = 0;
  }

  void dispose() {
    stopAll();
    _recorder.dispose();
  }
}
