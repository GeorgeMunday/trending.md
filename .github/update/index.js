const fs = require("fs");
const path = require("path");

const README_PATH = path.join(__dirname, "..", "README.md");
const OSSINSIGHT_API = "https://api.ossinsight.io/v1";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const githubHeaders = {
  Accept: "application/vnd.github+json",
  ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
};

async function fetchTrending(limit = 15, period = "past_24_hours") {
  const url = new URL(`${OSSINSIGHT_API}/trends/repos/`);
  url.searchParams.set("period", period);
  url.searchParams.set("language", "All");

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`OSS Insight API error: ${res.status}`);
  const json = await res.json();
  const rows = (json?.data?.rows || []).slice(0, limit);

  return rows
    .filter((row) => row.repo_name)
    .map((row) => ({
      repo: row.repo_name,
      url: `https://github.com/${row.repo_name}`,
      description: (row.description || "").trim(),
      starsToday: row.stars ?? "—",
    }));
}

async function fetchTopStarred(limit = 15) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", "stars:>1");
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(limit));

  const res = await fetch(url, { headers: githubHeaders });
  if (!res.ok) throw new Error(`GitHub Search API error: ${res.status}`);
  const json = await res.json();

  return (json.items || []).map((item) => ({
    repo: item.full_name,
    url: item.html_url,
    description: (item.description || "").trim(),
    stars: item.stargazers_count,
  }));
}

function renderTrendingTable(rows) {
  const lines = ["| # | Repository | Description | Stars Today |", "|---|---|---|---|"];
  rows.forEach((r, i) => {
    const desc = r.description.replace(/\|/g, "\\|").slice(0, 80);
    lines.push(`| ${i + 1} | [${r.repo}](${r.url}) | ${desc} | ${r.starsToday} |`);
  });
  return lines.join("\n");
}

function renderStarredTable(rows) {
  const lines = ["| # | Repository | Description | ⭐ Stars |", "|---|---|---|---|"];
  rows.forEach((r, i) => {
    const desc = r.description.replace(/\|/g, "\\|").slice(0, 80);
    lines.push(`| ${i + 1} | [${r.repo}](${r.url}) | ${desc} | ${r.stars.toLocaleString()} |`);
  });
  return lines.join("\n");
}

function replaceBetweenMarkers(content, startMarker, endMarker, newText) {
  const pattern = new RegExp(
    `${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`
  );
  return content.replace(pattern, `${startMarker}\n${newText}\n${endMarker}`);
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  let content = fs.readFileSync(README_PATH, "utf-8");

  const [trending, topStarred] = await Promise.all([
    fetchTrending(),
    fetchTopStarred(),
  ]);

  content = replaceBetweenMarkers(
    content,
    "<!-- TRENDING:START -->",
    "<!-- TRENDING:END -->",
    renderTrendingTable(trending)
  );
  content = replaceBetweenMarkers(
    content,
    "<!-- STARRED:START -->",
    "<!-- STARRED:END -->",
    renderStarredTable(topStarred)
  );

  const updated = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
  content = replaceBetweenMarkers(
    content,
    "<!-- UPDATED:START -->",
    "<!-- UPDATED:END -->",
    `Last updated: **${updated}**`
  );

  fs.writeFileSync(README_PATH, content);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});