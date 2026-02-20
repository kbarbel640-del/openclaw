/**
 * engagement-monitor.ts - Tracks user engagement for intelligent delivery
 * 
 * Monitors when user last sent a message to determine if they're actively
 * engaged in conversation or idle.
 */

export interface UserEngagement {
  lastMessageAgo: number;  // milliseconds since last user message
  isActiveConversation: boolean;  // within engagement window
  waitingForResponse: boolean;  // user asked a question recently
}

export class EngagementMonitor {
  private lastUserMessageAt: number;
  private engagementWindowMs: number;
  
  constructor(engagementWindowMs: number = 120000) { // Default 2 minutes
    this.lastUserMessageAt = Date.now();
    this.engagementWindowMs = engagementWindowMs;
  }
  
  /**
   * Record that user sent a message
   */
  recordUserMessage(): void {
    this.lastUserMessageAt = Date.now();
  }
  
  /**
   * Get current engagement state
   */
  getEngagement(): UserEngagement {
    const now = Date.now();
    const lastMessageAgo = now - this.lastUserMessageAt;
    const isActiveConversation = lastMessageAgo < this.engagementWindowMs;
    
    // If message was recent, assume user is waiting for response
    const waitingForResponse = isActiveConversation;
    
    return {
      lastMessageAgo,
      isActiveConversation,
      waitingForResponse,
    };
  }
  
  /**
   * Check if user is currently engaged
   */
  isEngaged(): boolean {
    return this.getEngagement().isActiveConversation;
  }
  
  /**
   * Update engagement window
   */
  setEngagementWindow(ms: number): void {
    this.engagementWindowMs = ms;
  }
}
