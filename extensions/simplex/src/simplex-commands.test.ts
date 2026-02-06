import { describe, expect, it } from "vitest";
import {
  buildDeleteChatItemCommand,
  buildReceiveFileCommand,
  buildSendMessagesCommand,
} from "./simplex-commands.js";

describe("simplex commands", () => {
  it("rejects unsafe chat refs in send command", () => {
    expect(() =>
      buildSendMessagesCommand({
        chatRef: "@123 ttl=on",
        composedMessages: [],
      }),
    ).toThrow("invalid SimpleX chat ref");
  });

  it("rejects unsafe chat item ids in delete command", () => {
    expect(() =>
      buildDeleteChatItemCommand({
        chatRef: "@123",
        chatItemIds: ["1,2"],
      }),
    ).toThrow("invalid SimpleX chat item id");
  });

  it("quotes file paths for receive command", () => {
    expect(
      buildReceiveFileCommand({
        fileId: 7,
        filePath: "/tmp/My File's Name.png",
      }),
    ).toBe("/freceive 7 '/tmp/My File\\'s Name.png'");
  });

  it("quotes JSON payload in send command", () => {
    expect(
      buildSendMessagesCommand({
        chatRef: "@123",
        composedMessages: [
          {
            msgContent: {
              type: "text",
              text: "hello world",
            },
          },
        ],
      }),
    ).toBe('/_send @123 json \'[{"msgContent":{"type":"text","text":"hello world"}}]\'');
  });
});
