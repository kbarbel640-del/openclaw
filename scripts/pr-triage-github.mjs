/**
 * GitHub API helpers for PR triage.
 * Handles data fetching, pagination, and PR summary generation.
 */

const GITHUB_API = "https://api.github.com";

export function createGitHubClient(token) {
  async function gh(path, opts = {}) {
    const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...opts.headers,
        },
        ...opts,
      });
      if (res.ok) { return res.json(); }
      if (res.status === 429 || res.status >= 500) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`GitHub API ${res.status} on ${path}, retry in ${delay}ms (${attempt + 1}/3)`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      const body = await res.text().catch(() => "");
      throw new Error(`GitHub API ${res.status}: ${path} — ${body.slice(0, 200)}`);
    }
    throw new Error(`GitHub API failed after 3 retries: ${path}`);
  }

  async function ghPaginate(path, maxItems = 100) {
    const items = [];
    let page = 1;
    while (items.length < maxItems) {
      const perPage = Math.min(100, maxItems - items.length);
      const sep = path.includes("?") ? "&" : "?";
      const data = await gh(`${path}${sep}per_page=${perPage}&page=${page}`);
      if (!Array.isArray(data) || data.length === 0) { break; }
      items.push(...data);
      if (data.length < perPage) { break; }
      page++;
    }
    return items;
  }

  return { gh, ghPaginate };
}

/**
 * Extract issue refs with contextual matching to reduce false positives.
 * Only matches GitHub-style references: "fixes #N", "closes #N", bare "#N" at line starts.
 */
export function extractIssueRefs(text) {
  if (!text) { return []; }
  const contextual = text.match(/(?:fix(?:es)?|close[sd]?|resolve[sd]?|refs?|see|relates?\s+to)\s+#(\d{1,6})/gi) || [];
  const bare = text.match(/(?:^|\n)\s*[-*]?\s*#(\d{1,6})\b/g) || [];
  const all = [...contextual, ...bare]
    .map((m) => { const match = m.match(/#(\d{1,6})/); return match ? `#${match[1]}` : null; })
    .filter(Boolean);
  return [...new Set(all)];
}

export function computeFileOverlap(filesA, filesB) {
  if (!filesA.length || !filesB.length) { return 0; }
  const setA = new Set(filesA);
  const intersection = filesB.filter((f) => setA.has(f));
  const union = new Set([...filesA, ...filesB]);
  return intersection.length / union.size;
}

function shortPath(filepath) {
  const parts = filepath.split("/");
  return parts.length > 2 ? parts.slice(-2).join("/") : filepath;
}

function summarizePR(pr) {
  const issueRefs = extractIssueRefs(pr.title + " " + (pr.body || ""));
  const shortFiles = (pr.files || []).slice(0, 6).map(shortPath);
  const moreFiles = (pr.files?.length || 0) > 6 ? ` +${pr.files.length - 6}` : "";
  const refs = issueRefs.length ? ` refs:${issueRefs.join(",")}` : "";
  const size = `+${pr.additions}/-${pr.deletions} ${pr.changed_files ?? pr.files?.length ?? "?"}f`;
  return `#${pr.number} ${pr.title} ${size}\n  ${shortFiles.join(",")}${moreFiles}${refs}`;
}

async function parallelMap(items, fn, concurrency = 10) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export async function getTargetPR(gh, repo, prNumber, maxDiffChars, token) {
  const pr = await gh(`/repos/${repo}/pulls/${prNumber}`);
  let diff = "";
  try {
    const res = await fetch(`${GITHUB_API}/repos/${repo}/pulls/${prNumber}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3.diff",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (res.ok) {
      diff = await res.text();
      if (diff.length > maxDiffChars) {
        diff = diff.slice(0, maxDiffChars) + "\n... (truncated)";
      }
    }
  } catch {}

  const files = await gh(`/repos/${repo}/pulls/${prNumber}/files?per_page=100`);
  return {
    number: pr.number,
    title: pr.title,
    body: (pr.body || "").slice(0, 4000),
    author: pr.user?.login,
    branch: pr.head?.ref,
    additions: pr.additions,
    deletions: pr.deletions,
    changed_files: pr.changed_files,
    created_at: pr.created_at,
    files: files.map((f) => f.filename),
    diff,
  };
}

/**
 * Fetch open PR summaries AND a file map for Jaccard computation.
 * Returns { summaries: string[], fileMap: Map<number, string[]> }
 */
export async function getOpenPRSummaries(gh, ghPaginate, repo, maxOpenPRs) {
  const prs = await ghPaginate(`/repos/${repo}/pulls?state=open&sort=created&direction=desc`, maxOpenPRs);
  const fileMap = new Map();

  const enriched = await parallelMap(prs, async (pr) => {
    let files = [];
    try {
      files = (await gh(`/repos/${repo}/pulls/${pr.number}/files?per_page=100`)).map((f) => f.filename);
    } catch (err) {
      console.warn(`Failed to fetch files for PR #${pr.number}: ${err.message}`);
    }
    return { pr, files };
  }, 10);

  const summaries = [];
  for (const { pr, files } of enriched) {
    fileMap.set(pr.number, files);
    summaries.push(summarizePR({ ...pr, author: pr.user?.login, files }));
  }
  return { summaries, fileMap };
}

export async function getRecentDecisions(ghPaginate, repo, maxHistory) {
  const merged = await ghPaginate(
    `/repos/${repo}/pulls?state=closed&sort=updated&direction=desc`,
    maxHistory * 2,
  );
  const mergedPRs = merged
    .filter((pr) => pr.merged_at)
    .slice(0, maxHistory)
    .map((pr) => `MERGED #${pr.number}: ${pr.title} (by ${pr.user?.login}, +${pr.additions}/-${pr.deletions})`);
  const rejectedPRs = merged
    .filter((pr) => !pr.merged_at)
    .slice(0, maxHistory)
    .map((pr) => `CLOSED #${pr.number}: ${pr.title} (by ${pr.user?.login}, +${pr.additions}/-${pr.deletions})`);
  return { mergedPRs, rejectedPRs };
}
