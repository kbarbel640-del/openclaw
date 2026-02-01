import { describe, expect, it } from "vitest";
import {
  MAX_QUICK_REPLIES,
  MAX_QUICK_REPLY_TITLE_LENGTH,
  MAX_BUTTONS,
  MAX_BUTTON_TITLE_LENGTH,
  MAX_GENERIC_ELEMENTS,
  MAX_GENERIC_TITLE_LENGTH,
  MAX_GENERIC_SUBTITLE_LENGTH,
  quickReplyText,
  quickReplyPhone,
  quickReplyEmail,
  quickReplyWithImage,
  buildQuickReplies,
  buttonUrl,
  buttonPostback,
  buttonCall,
  buttonLogin,
  buttonLogout,
  templateButton,
  genericElement,
  templateGeneric,
  templateMedia,
  messageWithQuickReplies,
  messageWithTemplate,
} from "./templates.js";

describe("Quick Reply Builders", () => {
  describe("quickReplyText", () => {
    it("creates a text quick reply", () => {
      const qr = quickReplyText("Yes", "CONFIRM_YES");
      expect(qr).toEqual({
        content_type: "text",
        title: "Yes",
        payload: "CONFIRM_YES",
      });
    });

    it("uses title as payload when payload is empty", () => {
      const qr = quickReplyText("Yes", "");
      expect(qr.payload).toBe("Yes");
    });

    it("truncates long titles", () => {
      const longTitle = "This is a very long title that exceeds the limit";
      const qr = quickReplyText(longTitle, "PAYLOAD");
      expect(qr.title.length).toBe(MAX_QUICK_REPLY_TITLE_LENGTH);
      expect(qr.title.endsWith("…")).toBe(true);
    });

    it("throws on empty title", () => {
      expect(() => quickReplyText("", "PAYLOAD")).toThrow("Quick reply title cannot be empty");
    });

    it("trims whitespace", () => {
      const qr = quickReplyText("  Yes  ", "  PAYLOAD  ");
      expect(qr.title).toBe("Yes");
      expect(qr.payload).toBe("PAYLOAD");
    });
  });

  describe("quickReplyPhone", () => {
    it("creates a phone number quick reply", () => {
      const qr = quickReplyPhone();
      expect(qr).toEqual({
        content_type: "user_phone_number",
      });
    });
  });

  describe("quickReplyEmail", () => {
    it("creates an email quick reply", () => {
      const qr = quickReplyEmail();
      expect(qr).toEqual({
        content_type: "user_email",
      });
    });
  });

  describe("quickReplyWithImage", () => {
    it("creates a quick reply with image", () => {
      const qr = quickReplyWithImage("Red", "COLOR_RED", "https://example.com/red.png");
      expect(qr).toEqual({
        content_type: "text",
        title: "Red",
        payload: "COLOR_RED",
        image_url: "https://example.com/red.png",
      });
    });

    it("throws on empty title", () => {
      expect(() => quickReplyWithImage("", "PAYLOAD", "https://example.com/img.png")).toThrow(
        "Quick reply title cannot be empty",
      );
    });
  });

  describe("buildQuickReplies", () => {
    it("builds quick replies from items", () => {
      const qrs = buildQuickReplies([
        { title: "Yes", payload: "YES" },
        { title: "No", payload: "NO" },
      ]);
      expect(qrs).toHaveLength(2);
      expect(qrs[0].title).toBe("Yes");
      expect(qrs[1].title).toBe("No");
    });

    it("uses title as default payload", () => {
      const qrs = buildQuickReplies([{ title: "Maybe" }]);
      expect(qrs[0].payload).toBe("Maybe");
    });

    it("throws when exceeding max quick replies", () => {
      const items = Array.from({ length: MAX_QUICK_REPLIES + 1 }, (_, i) => ({
        title: `Option ${i}`,
      }));
      expect(() => buildQuickReplies(items)).toThrow(
        `Maximum ${MAX_QUICK_REPLIES} quick replies allowed`,
      );
    });
  });
});

describe("Button Builders", () => {
  describe("buttonUrl", () => {
    it("creates a URL button", () => {
      const btn = buttonUrl("Visit", "https://example.com");
      expect(btn).toEqual({
        type: "web_url",
        title: "Visit",
        url: "https://example.com",
      });
    });

    it("includes webview options", () => {
      const btn = buttonUrl("Open", "https://example.com", {
        webviewHeight: "tall",
        messengerExtensions: true,
        fallbackUrl: "https://fallback.com",
      });
      expect(btn.webview_height_ratio).toBe("tall");
      expect(btn.messenger_extensions).toBe(true);
      expect(btn.fallback_url).toBe("https://fallback.com");
    });

    it("truncates long titles", () => {
      const longTitle = "This is a button with a very long title";
      const btn = buttonUrl(longTitle, "https://example.com");
      expect(btn.title.length).toBe(MAX_BUTTON_TITLE_LENGTH);
    });

    it("throws on empty title", () => {
      expect(() => buttonUrl("", "https://example.com")).toThrow("Button title cannot be empty");
    });
  });

  describe("buttonPostback", () => {
    it("creates a postback button", () => {
      const btn = buttonPostback("Click Me", "BUTTON_CLICKED");
      expect(btn).toEqual({
        type: "postback",
        title: "Click Me",
        payload: "BUTTON_CLICKED",
      });
    });
  });

  describe("buttonCall", () => {
    it("creates a call button", () => {
      const btn = buttonCall("Call Us", "+15551234567");
      expect(btn).toEqual({
        type: "phone_number",
        title: "Call Us",
        payload: "+15551234567",
      });
    });

    it("strips non-digit characters except +", () => {
      const btn = buttonCall("Call", "+1 (555) 123-4567");
      expect(btn.payload).toBe("+15551234567");
    });

    it("throws when missing country code", () => {
      expect(() => buttonCall("Call", "5551234567")).toThrow(
        "Phone number must include country code",
      );
    });
  });

  describe("buttonLogin", () => {
    it("creates a login button", () => {
      const btn = buttonLogin("https://example.com/login");
      expect(btn).toEqual({
        type: "account_link",
        url: "https://example.com/login",
      });
    });
  });

  describe("buttonLogout", () => {
    it("creates a logout button", () => {
      const btn = buttonLogout();
      expect(btn).toEqual({
        type: "account_unlink",
      });
    });
  });
});

describe("Template Builders", () => {
  describe("templateButton", () => {
    it("creates a button template", () => {
      const template = templateButton("Choose an option:", [
        buttonPostback("Option 1", "OPT_1"),
        buttonPostback("Option 2", "OPT_2"),
      ]);
      expect(template.type).toBe("template");
      expect(template.payload.template_type).toBe("button");
      expect((template.payload as { text: string }).text).toBe("Choose an option:");
      expect((template.payload as { buttons: unknown[] }).buttons).toHaveLength(2);
    });

    it("throws on empty text", () => {
      expect(() => templateButton("", [buttonPostback("Click", "CLICK")])).toThrow(
        "Button template text cannot be empty",
      );
    });

    it("throws on empty buttons", () => {
      expect(() => templateButton("Choose:", [])).toThrow("At least one button is required");
    });

    it("throws when exceeding max buttons", () => {
      const buttons = Array.from({ length: MAX_BUTTONS + 1 }, (_, i) =>
        buttonPostback(`Btn ${i}`, `BTN_${i}`),
      );
      expect(() => templateButton("Choose:", buttons)).toThrow(
        `Maximum ${MAX_BUTTONS} buttons allowed`,
      );
    });
  });

  describe("genericElement", () => {
    it("creates a basic element", () => {
      const elem = genericElement({ title: "Product Name" });
      expect(elem.title).toBe("Product Name");
    });

    it("includes subtitle and image", () => {
      const elem = genericElement({
        title: "Product",
        subtitle: "Description here",
        imageUrl: "https://example.com/product.jpg",
      });
      expect(elem.subtitle).toBe("Description here");
      expect(elem.image_url).toBe("https://example.com/product.jpg");
    });

    it("includes default action", () => {
      const elem = genericElement({
        title: "Product",
        defaultActionUrl: "https://example.com/product",
      });
      expect(elem.default_action).toEqual({
        type: "web_url",
        url: "https://example.com/product",
      });
    });

    it("includes buttons", () => {
      const elem = genericElement({
        title: "Product",
        buttons: [buttonPostback("Buy", "BUY")],
      });
      expect(elem.buttons).toHaveLength(1);
    });

    it("truncates long title", () => {
      const longTitle = "x".repeat(100);
      const elem = genericElement({ title: longTitle });
      expect(elem.title.length).toBe(MAX_GENERIC_TITLE_LENGTH);
    });

    it("truncates long subtitle", () => {
      const longSubtitle = "x".repeat(100);
      const elem = genericElement({ title: "Title", subtitle: longSubtitle });
      expect(elem.subtitle?.length).toBe(MAX_GENERIC_SUBTITLE_LENGTH);
    });

    it("throws on empty title", () => {
      expect(() => genericElement({ title: "" })).toThrow("Generic element title cannot be empty");
    });
  });

  describe("templateGeneric", () => {
    it("creates a generic template", () => {
      const template = templateGeneric([
        genericElement({ title: "Item 1" }),
        genericElement({ title: "Item 2" }),
      ]);
      expect(template.type).toBe("template");
      expect(template.payload.template_type).toBe("generic");
      expect((template.payload as { elements: unknown[] }).elements).toHaveLength(2);
    });

    it("throws on empty elements", () => {
      expect(() => templateGeneric([])).toThrow("Generic template requires at least one element");
    });

    it("throws when exceeding max elements", () => {
      const elements = Array.from({ length: MAX_GENERIC_ELEMENTS + 1 }, (_, i) =>
        genericElement({ title: `Item ${i}` }),
      );
      expect(() => templateGeneric(elements)).toThrow(
        `Maximum ${MAX_GENERIC_ELEMENTS} elements allowed`,
      );
    });
  });

  describe("templateMedia", () => {
    it("creates a media template with URL", () => {
      const template = templateMedia({
        mediaType: "image",
        url: "https://example.com/image.jpg",
      });
      expect(template.type).toBe("template");
      expect(template.payload.template_type).toBe("media");
      const elements = (template.payload as { elements: unknown[] }).elements as Array<{
        media_type: string;
        url: string;
      }>;
      expect(elements[0].media_type).toBe("image");
      expect(elements[0].url).toBe("https://example.com/image.jpg");
    });

    it("creates a media template with attachment ID", () => {
      const template = templateMedia({
        mediaType: "video",
        attachmentId: "12345",
      });
      const elements = (template.payload as { elements: unknown[] }).elements as Array<{
        attachment_id: string;
      }>;
      expect(elements[0].attachment_id).toBe("12345");
    });

    it("includes buttons", () => {
      const template = templateMedia({
        mediaType: "image",
        url: "https://example.com/image.jpg",
        buttons: [buttonUrl("View Full", "https://example.com/full")],
      });
      const elements = (template.payload as { elements: unknown[] }).elements as Array<{
        buttons: unknown[];
      }>;
      expect(elements[0].buttons).toHaveLength(1);
    });

    it("throws when neither url nor attachmentId provided", () => {
      expect(() => templateMedia({ mediaType: "image" })).toThrow(
        "Media template requires either url or attachmentId",
      );
    });
  });
});

describe("Message Body Builders", () => {
  describe("messageWithQuickReplies", () => {
    it("creates a message with quick replies", () => {
      const msg = messageWithQuickReplies("Choose one:", [
        quickReplyText("A", "A"),
        quickReplyText("B", "B"),
      ]);
      expect(msg.text).toBe("Choose one:");
      expect(msg.quick_replies).toHaveLength(2);
    });

    it("throws when exceeding max quick replies", () => {
      const qrs = Array.from({ length: MAX_QUICK_REPLIES + 1 }, (_, i) =>
        quickReplyText(`Opt ${i}`, `OPT_${i}`),
      );
      expect(() => messageWithQuickReplies("Choose:", qrs)).toThrow(
        `Maximum ${MAX_QUICK_REPLIES} quick replies allowed`,
      );
    });
  });

  describe("messageWithTemplate", () => {
    it("creates a message with template attachment", () => {
      const template = templateButton("Choose:", [buttonPostback("OK", "OK")]);
      const msg = messageWithTemplate(template);
      expect(msg.attachment).toBe(template);
    });
  });
});

describe("Constants", () => {
  it("has correct limits", () => {
    expect(MAX_QUICK_REPLIES).toBe(13);
    expect(MAX_QUICK_REPLY_TITLE_LENGTH).toBe(20);
    expect(MAX_BUTTONS).toBe(3);
    expect(MAX_BUTTON_TITLE_LENGTH).toBe(20);
    expect(MAX_GENERIC_ELEMENTS).toBe(10);
    expect(MAX_GENERIC_TITLE_LENGTH).toBe(80);
    expect(MAX_GENERIC_SUBTITLE_LENGTH).toBe(80);
  });
});
