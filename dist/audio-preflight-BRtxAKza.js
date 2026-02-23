import "./paths-DVBShlw6.js";
import { A as logVerbose, N as shouldLogVerbose } from "./subsystem-Dk9vptdH.js";
import "./utils-DHNjxV7z.js";
import "./pi-embedded-helpers-VKUwj79_.js";
import "./exec-BDA_Yyrr.js";
import "./agent-scope-9Xp7ERv_.js";
import "./model-selection-LGcPfPYa.js";
import "./github-copilot-token-CiF5Iyi2.js";
import "./boolean-BgXe2hyu.js";
import "./env-BglTbubH.js";
import "./config-BFqIpIaN.js";
import "./manifest-registry-qsNC0Vs3.js";
import "./plugins-BqubgBzU.js";
import "./sessions-C0GO_mnr.js";
import { a as runCapability, l as isAudioAttachment, n as createMediaAttachmentCache, r as normalizeMediaAttachments, t as buildProviderRegistry } from "./runner-CVeKzZQO.js";
import "./image-Bt9hGdbK.js";
import "./pi-model-discovery-EwKVHlZB.js";
import "./sandbox-BE-b8fdZ.js";
import "./chrome-CIS8D9FX.js";
import "./skills-ClV79GKX.js";
import "./routes-C7HQH21j.js";
import "./server-context-D1RX-Gax.js";
import "./image-ops-7FCglKpJ.js";
import "./store-Z0qYRiki.js";
import "./ports-DA9qgGkH.js";
import "./message-channel-Dy2obPV0.js";
import "./logging-CcxUDNcI.js";
import "./accounts-DgwQ0fS6.js";
import "./paths-BuQbsACT.js";
import "./tool-images-Dcxo2DY6.js";
import "./redact-Bb36nvYe.js";
import "./tool-display-CmS3h6Nq.js";
import "./fetch-C9UREBdO.js";

//#region src/media-understanding/audio-preflight.ts
/**
* Transcribes the first audio attachment BEFORE mention checking.
* This allows voice notes to be processed in group chats with requireMention: true.
* Returns the transcript or undefined if transcription fails or no audio is found.
*/
async function transcribeFirstAudio(params) {
	const { ctx, cfg } = params;
	const audioConfig = cfg.tools?.media?.audio;
	if (!audioConfig || audioConfig.enabled === false) return;
	const attachments = normalizeMediaAttachments(ctx);
	if (!attachments || attachments.length === 0) return;
	const firstAudio = attachments.find((att) => att && isAudioAttachment(att) && !att.alreadyTranscribed);
	if (!firstAudio) return;
	if (shouldLogVerbose()) logVerbose(`audio-preflight: transcribing attachment ${firstAudio.index} for mention check`);
	const providerRegistry = buildProviderRegistry(params.providers);
	const cache = createMediaAttachmentCache(attachments);
	try {
		const result = await runCapability({
			capability: "audio",
			cfg,
			ctx,
			attachments: cache,
			media: attachments,
			agentDir: params.agentDir,
			providerRegistry,
			config: audioConfig,
			activeModel: params.activeModel
		});
		if (!result || result.outputs.length === 0) return;
		const audioOutput = result.outputs.find((output) => output.kind === "audio.transcription");
		if (!audioOutput || !audioOutput.text) return;
		firstAudio.alreadyTranscribed = true;
		if (shouldLogVerbose()) logVerbose(`audio-preflight: transcribed ${audioOutput.text.length} chars from attachment ${firstAudio.index}`);
		return audioOutput.text;
	} catch (err) {
		if (shouldLogVerbose()) logVerbose(`audio-preflight: transcription failed: ${String(err)}`);
		return;
	} finally {
		await cache.cleanup();
	}
}

//#endregion
export { transcribeFirstAudio };