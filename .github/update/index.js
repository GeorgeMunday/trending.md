const fs = require('fs');
const path = require('path');

const readmePath = path.join(__dirname, '..', '..', 'README.md');

const START_MARKER = '<!-- trending:start -->';
const END_MARKER = '<!-- trending:end -->';

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

async function fetchTrendingRepos() {
  const since = new Date();
  since.setDate(since.getDate() - 7); // repos created in the last 7 days
  const query = `created:>${formatDate(since)}`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=10`;

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Trending.md-bot',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
    }
  });

  if (!res.ok) {
    throw new Error(`GitHub API request failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.items || [];
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

async function main() {
  let content = fs.readFileSync(readmePath, 'utf8');

  // Update trending table
  const repos = await fetchTrendingRepos();
  const table = buildTable(repos);
  const block = `${START_MARKER}\n${table}\n${END_MARKER}`;
  const blockRegex = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`);

  if (blockRegex.test(content)) {
    content = content.replace(blockRegex, block);
  } else {
    content += `\n\n## Trending Repositories\n\n${block}\n`;
  }

  // Update run counter
  const counterMarker = /(<!-- update-count -->)(\d+)/;
  if (counterMarker.test(content)) {
    content = content.replace(counterMarker, (_, tag, num) => `${tag}${parseInt(num, 10) + 1}`);
  } else {
    content = `<!-- update-count -->1\n\n${content}`;
  }

  fs.writeFileSync(readmePath, content);
  console.log(`README updated with ${repos.length} trending repos.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});