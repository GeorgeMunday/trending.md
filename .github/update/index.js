const fs = require('fs');
const path = require('path');

const readmePath = path.join(__dirname, '..', '..', 'README.md');

const GITHUB_HEADERS = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'Trending.md-bot',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
};

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

async function searchRepos(query, sort, limit = 10) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=desc&per_page=${limit}`;
  const res = await fetch(url, { headers: GITHUB_HEADERS });
  if (!res.ok) {
    throw new Error(`GitHub API request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.items || [];
}

function fetchTrendingRepos() {
  const since = new Date();
  since.setDate(since.getDate() - 31);
  return searchRepos(`created:>${formatDate(since)}`, 'stars');
}

function fetchMostStarredRepos() {
  return searchRepos('stars:>1', 'stars');
}

function fetchMostForkedRepos() {
  return searchRepos('forks:>1', 'forks');
}

function buildTable(repos) {
  const header = `| Repo | Stars | Language | Description |\n|------|------:|----------|-------------|`;
  const rows = repos.map(repo => {
    const name = `[${repo.full_name}](${repo.html_url})`;
    const stars = repo.stargazers_count.toLocaleString();
    const lang = repo.language || '—';
    const desc = (repo.description || '').replace(/\|/g, '\\|').slice(0, 100);
    return `| ${name} | ${stars} | ${lang} | ${desc} |`;
  });
  return [header, ...rows].join('\n');
}

function replaceBlock(content, startMarker, endMarker, table) {
  const block = `${startMarker}\n${table}\n${endMarker}`;
  const blockRegex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);
  if (blockRegex.test(content)) {
    return content.replace(blockRegex, block);
  }
  return `${content}\n\n${block}\n`;
}

async function main() {
  let content = fs.readFileSync(readmePath, 'utf8');

  const [trending, mostStarred, mostForked] = await Promise.all([
    fetchTrendingRepos(),
    fetchMostStarredRepos(),
    fetchMostForkedRepos()
  ]);

  content = replaceBlock(content, '<!-- trending:start -->', '<!-- trending:end -->', buildTable(trending));
  content = replaceBlock(content, '<!--stared:start-->', '<!--stared:end-->', buildTable(mostStarred));
  content = replaceBlock(content, '<!--forked:start-->', '<!--forked:end-->', buildTable(mostForked));

  fs.writeFileSync(readmePath, content);
  console.log(`README updated: ${trending.length} trending, ${mostStarred.length} most starred, ${mostForked.length} most forked.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});