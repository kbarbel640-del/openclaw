/**
 * Messenger template builders.
 *
 * Provides type-safe builders for Messenger structured messages:
 * - Quick replies (max 13, 20 char titles)
 * - Button templates (max 3 buttons, 20 char titles)
 * - Generic templates (max 10 elements)
 */

import type { MessengerQuickReplyButton } from "./types.js";

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of quick replies per message. */
export const MAX_QUICK_REPLIES = 13;

/** Maximum length for quick reply titles. */
export const MAX_QUICK_REPLY_TITLE_LENGTH = 20;

/** Maximum number of buttons per template. */
export const MAX_BUTTONS = 3;

/** Maximum length for button titles. */
export const MAX_BUTTON_TITLE_LENGTH = 20;

/** Maximum number of elements in a generic template. */
export const MAX_GENERIC_ELEMENTS = 10;

/** Maximum length for generic template titles. */
export const MAX_GENERIC_TITLE_LENGTH = 80;

/** Maximum length for generic template subtitles. */
export const MAX_GENERIC_SUBTITLE_LENGTH = 80;

// ============================================================================
// Button Types
// ============================================================================

/**
 * URL button - opens a webpage.
 */
export type MessengerUrlButton = {
  type: "web_url";
  title: string;
  url: string;
  webview_height_ratio?: "compact" | "tall" | "full";
  messenger_extensions?: boolean;
  fallback_url?: string;
};

/**
 * Postback button - sends a payload to webhook.
 */
export type MessengerPostbackButton = {
  type: "postback";
  title: string;
  payload: string;
};

/**
 * Call button - initiates a phone call.
 */
export type MessengerCallButton = {
  type: "phone_number";
  title: string;
  payload: string;
};

/**
 * Log in button - for account linking.
 */
export type MessengerLoginButton = {
  type: "account_link";
  url: string;
};

/**
 * Log out button - for account unlinking.
 */
export type MessengerLogoutButton = {
  type: "account_unlink";
};

/**
 * Union of all button types.
 */
export type MessengerButton =
  | MessengerUrlButton
  | MessengerPostbackButton
  | MessengerCallButton
  | MessengerLoginButton
  | MessengerLogoutButton;

// ============================================================================
// Template Types
// ============================================================================

/**
 * Button template payload.
 */
export type MessengerButtonTemplate = {
  template_type: "button";
  text: string;
  buttons: MessengerButton[];
};

/**
 * Generic template element.
 */
export type MessengerGenericElement = {
  title: string;
  subtitle?: string;
  image_url?: string;
  default_action?: {
    type: "web_url";
    url: string;
    webview_height_ratio?: "compact" | "tall" | "full";
    messenger_extensions?: boolean;
    fallback_url?: string;
  };
  buttons?: MessengerButton[];
};

/**
 * Generic template payload.
 */
export type MessengerGenericTemplate = {
  template_type: "generic";
  elements: MessengerGenericElement[];
};

/**
 * Media template payload.
 */
export type MessengerMediaTemplate = {
  template_type: "media";
  elements: Array<{
    media_type: "image" | "video";
    url?: string;
    attachment_id?: string;
    buttons?: MessengerButton[];
  }>;
};

/**
 * Union of all template types.
 */
export type MessengerTemplate =
  | MessengerButtonTemplate
  | MessengerGenericTemplate
  | MessengerMediaTemplate;

/**
 * Attachment wrapper for templates.
 */
export type MessengerTemplateAttachment = {
  type: "template";
  payload: MessengerTemplate;
};

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Truncate a string to a maximum length.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 1) + "…";
}

/**
 * Validate and format a button title.
 */
function validateButtonTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("Button title cannot be empty");
  }
  return truncate(trimmed, MAX_BUTTON_TITLE_LENGTH);
}

/**
 * Validate buttons array.
 */
function validateButtons(buttons: MessengerButton[]): MessengerButton[] {
  if (buttons.length === 0) {
    throw new Error("At least one button is required");
  }
  if (buttons.length > MAX_BUTTONS) {
    throw new Error(`Maximum ${MAX_BUTTONS} buttons allowed, got ${buttons.length}`);
  }
  return buttons;
}

// ============================================================================
// Quick Reply Builders
// ============================================================================

/**
 * Build a text quick reply button.
 */
export function quickReplyText(title: string, payload: string): MessengerQuickReplyButton {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("Quick reply title cannot be empty");
  }
  return {
    content_type: "text",
    title: truncate(trimmedTitle, MAX_QUICK_REPLY_TITLE_LENGTH),
    payload: payload.trim() || trimmedTitle,
  };
}

/**
 * Build a phone number quick reply button.
 */
export function quickReplyPhone(): MessengerQuickReplyButton {
  return {
    content_type: "user_phone_number",
  };
}

/**
 * Build an email quick reply button.
 */
export function quickReplyEmail(): MessengerQuickReplyButton {
  return {
    content_type: "user_email",
  };
}

/**
 * Build a quick reply with an image.
 */
export function quickReplyWithImage(
  title: string,
  payload: string,
  imageUrl: string,
): MessengerQuickReplyButton {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("Quick reply title cannot be empty");
  }
  return {
    content_type: "text",
    title: truncate(trimmedTitle, MAX_QUICK_REPLY_TITLE_LENGTH),
    payload: payload.trim() || trimmedTitle,
    image_url: imageUrl.trim(),
  };
}

/**
 * Build an array of quick replies from title/payload pairs.
 */
export function buildQuickReplies(
  items: Array<{ title: string; payload?: string }>,
): MessengerQuickReplyButton[] {
  if (items.length > MAX_QUICK_REPLIES) {
    throw new Error(`Maximum ${MAX_QUICK_REPLIES} quick replies allowed, got ${items.length}`);
  }
  return items.map((item) => quickReplyText(item.title, item.payload ?? item.title));
}

// ============================================================================
// Button Builders
// ============================================================================

/**
 * Build a URL button.
 */
export function buttonUrl(
  title: string,
  url: string,
  options?: {
    webviewHeight?: "compact" | "tall" | "full";
    messengerExtensions?: boolean;
    fallbackUrl?: string;
  },
): MessengerUrlButton {
  const button: MessengerUrlButton = {
    type: "web_url",
    title: validateButtonTitle(title),
    url: url.trim(),
  };
  if (options?.webviewHeight) {
    button.webview_height_ratio = options.webviewHeight;
  }
  if (options?.messengerExtensions) {
    button.messenger_extensions = true;
    if (options.fallbackUrl) {
      button.fallback_url = options.fallbackUrl.trim();
    }
  }
  return button;
}

/**
 * Build a postback button.
 */
export function buttonPostback(title: string, payload: string): MessengerPostbackButton {
  return {
    type: "postback",
    title: validateButtonTitle(title),
    payload: payload.trim(),
  };
}

/**
 * Build a call button.
 */
export function buttonCall(title: string, phoneNumber: string): MessengerCallButton {
  const formatted = phoneNumber.trim().replace(/[^\d+]/g, "");
  if (!formatted.startsWith("+")) {
    throw new Error("Phone number must include country code (e.g., +1234567890)");
  }
  return {
    type: "phone_number",
    title: validateButtonTitle(title),
    payload: formatted,
  };
}

/**
 * Build a login button.
 */
export function buttonLogin(url: string): MessengerLoginButton {
  return {
    type: "account_link",
    url: url.trim(),
  };
}

/**
 * Build a logout button.
 */
export function buttonLogout(): MessengerLogoutButton {
  return {
    type: "account_unlink",
  };
}

// ============================================================================
// Template Builders
// ============================================================================

/**
 * Build a button template.
 */
export function templateButton(
  text: string,
  buttons: MessengerButton[],
): MessengerTemplateAttachment {
  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error("Button template text cannot be empty");
  }
  return {
    type: "template",
    payload: {
      template_type: "button",
      text: trimmedText,
      buttons: validateButtons(buttons),
    },
  };
}

/**
 * Build a generic template element.
 */
export function genericElement(params: {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  buttons?: MessengerButton[];
  defaultActionUrl?: string;
}): MessengerGenericElement {
  const title = params.title.trim();
  if (!title) {
    throw new Error("Generic element title cannot be empty");
  }

  const element: MessengerGenericElement = {
    title: truncate(title, MAX_GENERIC_TITLE_LENGTH),
  };

  if (params.subtitle?.trim()) {
    element.subtitle = truncate(params.subtitle.trim(), MAX_GENERIC_SUBTITLE_LENGTH);
  }

  if (params.imageUrl?.trim()) {
    element.image_url = params.imageUrl.trim();
  }

  if (params.defaultActionUrl?.trim()) {
    element.default_action = {
      type: "web_url",
      url: params.defaultActionUrl.trim(),
    };
  }

  if (params.buttons?.length) {
    element.buttons = validateButtons(params.buttons);
  }

  return element;
}

/**
 * Build a generic template.
 */
export function templateGeneric(elements: MessengerGenericElement[]): MessengerTemplateAttachment {
  if (elements.length === 0) {
    throw new Error("Generic template requires at least one element");
  }
  if (elements.length > MAX_GENERIC_ELEMENTS) {
    throw new Error(`Maximum ${MAX_GENERIC_ELEMENTS} elements allowed, got ${elements.length}`);
  }
  return {
    type: "template",
    payload: {
      template_type: "generic",
      elements,
    },
  };
}

/**
 * Build a media template.
 */
export function templateMedia(params: {
  mediaType: "image" | "video";
  url?: string;
  attachmentId?: string;
  buttons?: MessengerButton[];
}): MessengerTemplateAttachment {
  if (!params.url && !params.attachmentId) {
    throw new Error("Media template requires either url or attachmentId");
  }

  const element: MessengerMediaTemplate["elements"][0] = {
    media_type: params.mediaType,
  };

  if (params.url) {
    element.url = params.url.trim();
  }
  if (params.attachmentId) {
    element.attachment_id = params.attachmentId.trim();
  }
  if (params.buttons?.length) {
    element.buttons = validateButtons(params.buttons);
  }

  return {
    type: "template",
    payload: {
      template_type: "media",
      elements: [element],
    },
  };
}

// ============================================================================
// Message Body Builders
// ============================================================================

/**
 * Build a message body with quick replies.
 */
export function messageWithQuickReplies(
  text: string,
  quickReplies: MessengerQuickReplyButton[],
): { text: string; quick_replies: MessengerQuickReplyButton[] } {
  if (quickReplies.length > MAX_QUICK_REPLIES) {
    throw new Error(
      `Maximum ${MAX_QUICK_REPLIES} quick replies allowed, got ${quickReplies.length}`,
    );
  }
  return {
    text: text.trim(),
    quick_replies: quickReplies,
  };
}

/**
 * Build a message body with a template attachment.
 */
export function messageWithTemplate(template: MessengerTemplateAttachment): {
  attachment: MessengerTemplateAttachment;
} {
  return {
    attachment: template,
  };
}
