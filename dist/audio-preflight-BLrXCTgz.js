import { S as logVerbose, T as shouldLogVerbose } from "./entry.js";
import "./auth-profiles-C9_xOnFy.js";
import "./utils-M-vQAlGY.js";
import "./exec-CPPvAI1K.js";
import "./agent-scope-BabSooVs.js";
import "./github-copilot-token-C9W4SY9o.js";
import "./pi-model-discovery-EhM2JAQo.js";
import "./config-DERbrvBI.js";
import "./manifest-registry-4qV6l7iG.js";
import "./plugins-Bj04t2xy.js";
import "./logging-B5vJSgy6.js";
import "./accounts-auAzqhkF.js";
import "./message-channel-C6pzZhm1.js";
import "./image-ops-DNHr22g3.js";
import "./fetch-Di_volBf.js";
import "./tool-images-cW3M5OUJ.js";
import "./server-context-BNtjuKAn.js";
import "./chrome-DFsbt9ef.js";
import "./ports-rKsugsSD.js";
import "./pi-embedded-helpers-C1-1-U6z.js";
import "./sessions-BJEyAc_A.js";
import { a as runCapability, l as isAudioAttachment, n as createMediaAttachmentCache, r as normalizeMediaAttachments, t as buildProviderRegistry } from "./runner-XcgJy_ug.js";
import "./image-WxJLBk1p.js";
import "./models-config-CrH18Kky.js";
import "./sandbox-D64T9Pyj.js";
import "./skills-DQyYx0by.js";
import "./routes-D0Nv_oa2.js";
import "./store-CC9NUiWk.js";
import "./paths-erOp4-FP.js";
import "./redact-Bt-krp_b.js";
import "./tool-display-CQTF9Pgy.js";

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