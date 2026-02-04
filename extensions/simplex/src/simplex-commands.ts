export type SimplexChatType = "direct" | "group" | "local";

export type SimplexChatRef = {
  type: SimplexChatType;
  id: number | string;
  scope?: string | null;
};

export type SimplexMsgContent = {
  type: "text" | "link" | "image" | "video" | "voice" | "file" | "report" | "chat" | "unknown";
  text: string;
  [key: string]: unknown;
};

export type SimplexComposedMessage = {
  msgContent: SimplexMsgContent;
  quotedItemId?: number;
  fileSource?: {
    filePath: string;
    cryptoArgs?: { fileKey: string; fileNonce: string };
  };
  mentions?: Record<string, number>;
};

export function formatChatRef(ref: SimplexChatRef): string {
  const prefix = ref.type === "direct" ? "@" : ref.type === "group" ? "#" : "*";
  const scope = ref.scope ? String(ref.scope) : "";
  return `${prefix}${ref.id}${scope}`;
}

export function buildSendMessagesCommand(params: {
  chatRef: string;
  composedMessages: SimplexComposedMessage[];
  liveMessage?: boolean;
  ttl?: number;
}): string {
  const liveFlag = params.liveMessage ? " live=on" : "";
  const ttlFlag = typeof params.ttl === "number" ? ` ttl=${params.ttl}` : "";
  const json = JSON.stringify(params.composedMessages);
  return `/_send ${params.chatRef}${liveFlag}${ttlFlag} json ${json}`;
}

export function buildUpdateChatItemCommand(params: {
  chatRef: string;
  chatItemId: number;
  updatedMessage: SimplexComposedMessage;
  liveMessage?: boolean;
}): string {
  const liveFlag = params.liveMessage ? " live=on" : "";
  const json = JSON.stringify(params.updatedMessage);
  return `/_update item ${params.chatRef} ${params.chatItemId}${liveFlag} json ${json}`;
}

export function buildDeleteChatItemCommand(params: {
  chatRef: string;
  chatItemIds: Array<number | string>;
  deleteMode?: "broadcast" | "internal" | "internalMark";
}): string {
  const deleteMode = params.deleteMode ?? "broadcast";
  const ids = params.chatItemIds.map((id) => String(id)).join(",");
  return `/_delete item ${params.chatRef} ${ids} ${deleteMode}`;
}

export function buildReactionCommand(params: {
  chatRef: string;
  chatItemId: number;
  add: boolean;
  reaction: Record<string, unknown>;
}): string {
  const toggle = params.add ? "on" : "off";
  const json = JSON.stringify(params.reaction);
  return `/_reaction ${params.chatRef} ${params.chatItemId} ${toggle} ${json}`;
}

export function buildReceiveFileCommand(params: {
  fileId: number;
  filePath?: string;
  inline?: boolean;
  encrypt?: boolean;
  approvedRelays?: boolean;
}): string {
  const flags: string[] = [];
  if (params.approvedRelays) {
    flags.push("approved_relays=on");
  }
  if (typeof params.encrypt === "boolean") {
    flags.push(`encrypt=${params.encrypt ? "on" : "off"}`);
  }
  if (typeof params.inline === "boolean") {
    flags.push(`inline=${params.inline ? "on" : "off"}`);
  }
  const path = params.filePath ? ` ${params.filePath}` : "";
  const suffix = flags.length > 0 ? ` ${flags.join(" ")}` : "";
  return `/freceive ${params.fileId}${suffix}${path}`;
}

export function buildCancelFileCommand(fileId: number): string {
  return `/fcancel ${fileId}`;
}

function normalizeCommandId(value: number | string): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return String(value).trim();
}

function normalizeContactRef(value: number | string): string {
  const raw = normalizeCommandId(value);
  if (!raw) {
    return raw;
  }
  if (raw.startsWith("@")) {
    return raw;
  }
  if (/^(contact|user|member):/i.test(raw)) {
    return `@${raw.slice(raw.indexOf(":") + 1).trim()}`;
  }
  return `@${raw}`;
}

function normalizeGroupRef(value: number | string): string {
  const raw = normalizeCommandId(value);
  if (!raw) {
    return raw;
  }
  if (raw.startsWith("#")) {
    return raw;
  }
  if (/^group:/i.test(raw)) {
    return `#${raw.slice("group:".length).trim()}`;
  }
  return `#${raw}`;
}

function formatSearchArg(search?: string | null): string {
  const trimmed = search?.trim();
  if (!trimmed) {
    return "";
  }
  if (/\s/.test(trimmed)) {
    return `'${trimmed.replace(/'/g, "\\'")}'`;
  }
  return trimmed;
}

export function buildListUsersCommand(): string {
  return "/_users";
}

export function buildShowActiveUserCommand(): string {
  return "/_user";
}

export function buildListContactsCommand(userId: number | string): string {
  const id = normalizeCommandId(userId);
  return `/_contacts ${id}`;
}

export function buildListGroupsCommand(params: {
  userId: number | string;
  contactId?: number | string | null;
  search?: string | null;
}): string {
  const userId = normalizeCommandId(params.userId);
  const contactRef = params.contactId ? normalizeContactRef(params.contactId) : "";
  const search = formatSearchArg(params.search);
  const parts = ["/_groups", userId, contactRef, search].filter(Boolean);
  return parts.join(" ");
}

export function buildListGroupMembersCommand(params: {
  groupId: number | string;
  search?: string | null;
}): string {
  const groupRef = normalizeGroupRef(params.groupId);
  const search = formatSearchArg(params.search);
  const parts = ["/_members", groupRef, search].filter(Boolean);
  return parts.join(" ");
}

export function buildAddGroupMemberCommand(params: {
  groupId: number | string;
  contactId: number | string;
}): string {
  return `/_add ${normalizeGroupRef(params.groupId)} ${normalizeContactRef(params.contactId)}`;
}

export function buildRemoveGroupMemberCommand(params: {
  groupId: number | string;
  memberId: number | string;
}): string {
  return `/_remove ${normalizeGroupRef(params.groupId)} ${normalizeContactRef(params.memberId)}`;
}

export function buildLeaveGroupCommand(groupId: number | string): string {
  return `/_leave ${normalizeGroupRef(groupId)}`;
}

export function buildUpdateGroupProfileCommand(params: {
  groupId: number | string;
  profile: Record<string, unknown>;
}): string {
  return `/_group_profile ${normalizeGroupRef(params.groupId)} ${JSON.stringify(params.profile)}`;
}
