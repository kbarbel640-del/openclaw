# Raw Requirements: Web Search TTS Integration

## Source

User's raw requirements (translated from Russian):

> We have the `/web` command that runs web search using a skill (Google/Gemini). When this pipeline finishes, the message "Хорошо" (OK/Result) is displayed in Telegram.
>
> I would like to propose adding an inline button under this message (only when it's a web search result) with an emoji and the word "Озвучить" (Voice/Narrate). When this button is pressed, a system message should appear showing the progress of audio generation.
>
> For how to do the voiceover, I'll show you a project where text-to-speech is done via MiniMax, and you'll take all the necessary TTS architecture from there.
>
> When the button is pressed, the button text itself should become the progress (percentages + progress bar displayed directly on the button).
>
> When generation is complete, an audio file appears in the chat that can be clicked and played - this is the text-to-speech narration of the web search result. The button disappears after the audio file is generated.

## Functional Requirements

### Trigger
- **Command**: `/web <query>` (exists)
- **Result message**: Currently shows "○ Результат поиска:\n\n{response}"
- **New behavior**: Add inline button "Озвучить" under the result message

### Button Behavior
1. **Initial state**: Button with emoji + "Озвучить" text
2. **On click**: Button text changes to show progress (percentage + progress bar)
3. **On complete**:
   - Audio file sent to chat
   - Button removed
   - Audio is TTS narration of web search result

### Audio Generation
- **Provider**: MiniMax TTS 2.6
- **Reference implementation**: `/home/almaz/sandboxes/005_epub`
- **Input text**: The web search result response text
- **Output format**: MP3 audio file
- **Progress indication**: Update button text with percentage + progress bar during generation

### Integration Points
- **Web search executor**: `src/web-search/executor.ts`
- **Telegram bot**: `src/telegram/bot.ts` (callback handler needed)
- **Messages**: `src/web-search/messages.ts`
- **TTS provider**: MiniMax TTS 2.6 (from reference project)

## Non-Functional Requirements

- Progress should be visible to user during TTS generation
- Button should only appear for successful web search results
- Audio file should be playable in Telegram
- Handle TTS API errors gracefully

## Constraints

- Telegram callback data limit: 64 bytes
- Must handle Russian text for TTS
- MiniMax API authentication required
- Web search results may be long (chunking may be needed for TTS)

## Open Questions

1. What voice/emotion settings for MiniMax TTS?
2. Should we cache generated audio files?
3. What's the max text length for TTS?
4. Should progress be real-time or estimated?
5. Error handling behavior if TTS fails?
