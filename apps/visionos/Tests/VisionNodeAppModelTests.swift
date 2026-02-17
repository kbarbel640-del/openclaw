import Testing
@testable import OpenClawVision

@Suite(.serialized) struct VisionNodeAppModelTests {
    @Test @MainActor func activatesContinuousListeningOnControlPanelEntry() {
        let model = VisionNodeAppModel()
        model.activateControlPanel()

        #expect(model.voiceState == .continuousListening)
        #expect(model.statusPillText == "Listening")
    }

    @Test @MainActor func bargeInTransitionsBackToContinuous() {
        let model = VisionNodeAppModel()
        model.activateControlPanel()
        model.beginAssistantSpeech()

        model.onUserSpeechDetected()

        #expect(model.voiceState == .continuousListening)
        #expect(model.transitionHistory.contains(.bargeIn))
    }

    @Test @MainActor func degradedSignalsTriggerAutoPTTFallback() {
        let model = VisionNodeAppModel()
        model.activateControlPanel()

        model.registerRecognitionSignal(latencySeconds: 3.5, hasError: true, permissionAvailable: true)

        #expect(model.voiceState == .fallbackPTT)
        #expect(model.statusPillText == "PTT Fallback")
    }

    @Test @MainActor func healthySignalsRecoverFromFallback() {
        let model = VisionNodeAppModel()
        model.activateControlPanel()
        model.registerRecognitionSignal(latencySeconds: 3.2, hasError: true, permissionAvailable: true)

        model.registerRecognitionSignal(latencySeconds: 0.3, hasError: false, permissionAvailable: true)
        model.registerRecognitionSignal(latencySeconds: 0.2, hasError: false, permissionAvailable: true)

        #expect(model.voiceState == .continuousListening)
        #expect(model.transitionHistory.contains(.recovering))
    }

    @Test @MainActor func pinchHoldFlowCompletesPTTCycle() {
        let model = VisionNodeAppModel()

        model.handleGestureIntent(.pinchHoldStart)
        #expect(model.isPushToTalkActive == true)

        model.handleGestureIntent(.pinchHoldEnd)
        #expect(model.isPushToTalkActive == false)
        #expect(model.voiceState == .recovering)
    }

    @Test @MainActor func downwardFlickCancelsPTT() {
        let model = VisionNodeAppModel()
        model.handleGestureIntent(.pinchHoldStart)

        model.handleGestureIntent(.holdDownwardFlickCancel)

        #expect(model.isPushToTalkActive == false)
        #expect(model.statusPillText == "PTT Cancelled")
    }

    @Test @MainActor func voiceCommandsOpenSurfaces() {
        let model = VisionNodeAppModel()

        model.handleVoiceCommand("open chat")
        model.handleVoiceCommand("打开画布")
        model.handleVoiceCommand("使用量を表示")

        #expect(model.isChatWindowOpen == true)
        #expect(model.isCanvasWindowOpen == true)
        #expect(model.isUsageWindowOpen == true)
    }

    @Test @MainActor func voiceCommandsQueueVisionSkills() {
        let model = VisionNodeAppModel()

        model.handleVoiceCommand("看一下这是什么")
        #expect(model.lastSkillCommand == "/vision_scene_describe")

        model.handleVoiceCommand("翻译这段")
        #expect(model.lastSkillCommand == "/vision_translate")

        model.handleVoiceCommand("记住这个")
        #expect(model.lastSkillCommand == "/vision_record_memory")
    }

    @Test @MainActor func languageToggleCyclesZhEnJa() {
        let model = VisionNodeAppModel()
        #expect(model.activeLanguage == .zhHans)

        model.handleGestureIntent(.pinchOnce(.toggleTranslateMode))
        #expect(model.activeLanguage == .en)

        model.handleGestureIntent(.pinchOnce(.toggleTranslateMode))
        #expect(model.activeLanguage == .ja)

        model.handleGestureIntent(.pinchOnce(.toggleTranslateMode))
        #expect(model.activeLanguage == .zhHans)
    }

    @Test @MainActor func talkCommandSetUsesExistingProtocolNames() {
        let model = VisionNodeAppModel()
        #expect(model.talkPTTCommands == ["talk.ptt.start", "talk.ptt.stop", "talk.ptt.cancel", "talk.ptt.once"])
    }
}
