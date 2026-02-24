// Temporary patch file for the fix
export const PATCH_CONTENT = `
export async function resolveDiscordThreadParentInfo(params: {
  client: Client;
  threadChannel: DiscordThreadChannel;
  channelInfo: import("./message-utils.js").DiscordChannelInfo | null;
}): Promise<DiscordThreadParentInfo> {
  const { threadChannel, channelInfo, client } = params;
  let parentId =
    threadChannel.parentId ?? threadChannel.parent?.id ?? channelInfo?.parentId ?? undefined;

  // Fallback: fetch thread channel info to get parentId when not available in initial payload
  // This can happen with certain thread events where parentId is not populated immediately
  if (!parentId && threadChannel.id) {
    const threadInfo = await resolveDiscordChannelInfo(client, threadChannel.id);
    parentId = threadInfo?.parentId ?? undefined;
  }

  if (!parentId) {
    return {};
  }
  let parentName = threadChannel.parent?.name;
  const parentInfo = await resolveDiscordChannelInfo(client, parentId);
  parentName = parentName ?? parentInfo?.name;
  const parentType = parentInfo?.type;
  return { id: parentId, name: parentName, type: parentType };
}
`;
