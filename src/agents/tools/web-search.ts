import { fetchWithSsrFGuard } from "../../infra/net/fetch-guard.js";
import type { ToolUsage } from "../tool.js";
import type { BraveSearchParams, BraveSearchResult } from "./brave-search.js";

export const webSearchTool: ToolUsage<BraveSearchParams> = {
	async invoke(params) {
		return performSearch(params);
	},
};

export async function webSearch(params: BraveSearchParams): Promise<{
	results: BraveSearchResult[];
}> {
	return performSearch(params);
}

async function performSearch(params: BraveSearchParams): Promise<{
	results: BraveSearchResult[];
}> {
	const apiKey = params.apiKey ?? process.env.BRAVE_API_KEY;
	if (!apiKey) {
		throw new Error("Brave API key not configured");
	}

	const url = new URL("https://api.search.brave.com/res/v1/web/search");
	url.searchParams.set("q", params.query);
	url.searchParams.set("count", String(params.count ?? 10));
	if (params.offset) {
		url.searchParams.set("offset", String(params.offset));
	}
	if (params.country) {
		url.searchParams.set("country", params.country);
	}
	if (params.searchLang) {
		url.searchParams.set("search_lang", params.searchLang);
	}
	if (params.uiLang) {
		url.searchParams.set("ui_lang", params.uiLang);
	}
	if (params.freshness) {
		url.searchParams.set("freshness", params.freshness);
	}

	const result = await fetchWithSsrFGuard({
		url: url.toString(),
		timeoutMs: (params.timeoutSeconds ?? 30) * 1000,
		init: {
			headers: {
				Accept: "application/json",
				"X-Subscription-Token": apiKey,
			},
		},
	});

	if (!result.response.ok) {
		throw new Error(`Brave search failed: ${result.response.status}`);
	}

	const data = await result.response.json() as { web?: { results?: Array<{
		title?: string;
		description?: string;
		url?: string;
		profile?: { name?: string };
	}>}>;

	const results: BraveSearchResult[] = (data.web?.results ?? []).map((r) => ({
		title: r.title ?? "",
		description: r.description ?? "",
		url: r.url ?? "",
		source: r.profile?.name ?? "Brave Search",
	}));

	return { results };
}
