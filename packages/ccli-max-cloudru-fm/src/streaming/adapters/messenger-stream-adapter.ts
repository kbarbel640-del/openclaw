/**
 * Stream adapter interface for platform-specific streaming behavior.
 * Defines the contract for sending messages and typing indicators.
 */

/**
 * Platform adapter for streaming responses to different messenger platforms.
 * Each platform can implement different behavior for typing indicators,
 * message editing, and message length limits.
 */
export interface IStreamAdapter {
  /**
   * Send a typing indicator to the chat.
   * @param chatId - Platform-specific chat identifier
   */
  sendTypingIndicator(chatId: string): Promise<void>;

  /**
   * Send a new message to the chat.
   * @param chatId - Platform-specific chat identifier
   * @param text - Message text to send
   * @returns Message ID for potential future edits
   */
  sendMessage(chatId: string, text: string): Promise<string>;

  /**
   * Edit an existing message.
   * @param chatId - Platform-specific chat identifier
   * @param messageId - ID of message to edit
   * @param text - New message text
   */
  editMessage(chatId: string, messageId: string, text: string): Promise<void>;

  /**
   * Check if this adapter supports message editing.
   * @returns true if editMessage is supported
   */
  supportsEdit(): boolean;
}
