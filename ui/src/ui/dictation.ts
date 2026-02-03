/**
 * Simple Web Speech API dictation helper
 * Provides speech-to-text input for the chat compose area
 */

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface DictationState {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
}

export interface DictationCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void;
  onStateChange: (state: DictationState) => void;
}

/**
 * Check if Web Speech API is supported
 */
export function isDictationSupported(): boolean {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Create a dictation controller
 */
export function createDictationController(callbacks: DictationCallbacks) {
  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognitionClass) {
    return {
      start: () => {
        callbacks.onStateChange({
          isListening: false,
          isSupported: false,
          error: "Speech recognition not supported in this browser",
        });
      },
      stop: () => {},
      toggle: () => {},
      isListening: () => false,
      isSupported: false,
    };
  }

  let recognition: SpeechRecognition | null = null;
  let isListening = false;

  const createRecognition = () => {
    const rec = new SpeechRecognitionClass();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";

    rec.onstart = () => {
      isListening = true;
      callbacks.onStateChange({
        isListening: true,
        isSupported: true,
        error: null,
      });
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        callbacks.onTranscript(finalTranscript, true);
      } else if (interimTranscript) {
        callbacks.onTranscript(interimTranscript, false);
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("[Dictation] Error:", event.error);
      
      // Don't show error for aborted (user stopped)
      if (event.error === "aborted") {
        return;
      }

      let errorMsg = "Speech recognition error";
      if (event.error === "not-allowed") {
        errorMsg = "Microphone access denied";
      } else if (event.error === "no-speech") {
        errorMsg = "No speech detected";
      } else if (event.error === "network") {
        errorMsg = "Network error";
      }

      callbacks.onStateChange({
        isListening: false,
        isSupported: true,
        error: errorMsg,
      });
      isListening = false;
    };

    rec.onend = () => {
      isListening = false;
      callbacks.onStateChange({
        isListening: false,
        isSupported: true,
        error: null,
      });
    };

    return rec;
  };

  const start = () => {
    if (isListening) return;
    
    try {
      recognition = createRecognition();
      recognition.start();
    } catch (err) {
      console.error("[Dictation] Failed to start:", err);
      callbacks.onStateChange({
        isListening: false,
        isSupported: true,
        error: "Failed to start speech recognition",
      });
    }
  };

  const stop = () => {
    if (recognition && isListening) {
      recognition.stop();
      recognition = null;
    }
  };

  const toggle = () => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  };

  return {
    start,
    stop,
    toggle,
    isListening: () => isListening,
    isSupported: true,
  };
}
