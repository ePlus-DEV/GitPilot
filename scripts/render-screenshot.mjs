import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const output = args.get('--output') ?? 'screenshots/gitpilot.svg';
const width = Number(args.get('--width') ?? 1440);
const height = Number(args.get('--height') ?? 920);

function git(args, fallback = '') {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
}

function escapeXml(value) {
  return String(value).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function truncate(value, max) {
  const text = String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const repoName = git(['rev-parse', '--show-toplevel'], process.cwd()).split(/[\\/]/).pop() || 'GitPilot';
const branch = git(['branch', '--show-current'], 'work') || 'HEAD';
const statusLines = git(['status', '--porcelain'], '').split('\n').filter(Boolean);
const rawLog = git(['log', '--date=short', '--max-count=18', '--pretty=format:%h%x1f%an%x1f%ad%x1f%D%x1f%s'], '');
const commits = rawLog.split('\n').filter(Boolean).map(line => {
  const [hash, author, date, refs, message] = line.split('\x1f');
  return { hash, author, date, refs, message };
});
const branches = git(['branch', '--all', '--format=%(refname:short)'], branch).split('\n').filter(Boolean).slice(0, 11);

const rows = commits.map((commit, index) => {
  const y = 136 + index * 38;
  const lane = index % 5;
  const x = 324 + lane * 22;
  const color = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6'][lane];
  const refBadge = commit.refs ? `<rect x="${x + 26}" y="${y - 12}" width="${Math.min(180, 18 + commit.refs.length * 6)}" height="18" rx="5" fill="#0f2a44" stroke="#38bdf855"/><text x="${x + 36}" y="${y + 1}" class="tiny" fill="#7dd3fc">${escapeXml(truncate(commit.refs.replace('HEAD -> ', ''), 24))}</text>` : '';
  return `
    <line x1="${x}" y1="${y - 27}" x2="${x}" y2="${y + 27}" stroke="${color}" stroke-width="2" opacity="0.75"/>
    <circle cx="${x}" cy="${y}" r="7" fill="${color}"/>
    ${refBadge}
    <text x="520" y="${y - 3}" class="msg">${escapeXml(truncate(commit.message, 78))}</text>
    <text x="520" y="${y + 15}" class="meta">${escapeXml(commit.hash)} · ${escapeXml(commit.author)} · ${escapeXml(commit.date)}</text>`;
}).join('\n');

const branchRows = branches.map((name, index) => {
  const y = 188 + index * 28;
  const active = name === branch;
  return `<rect x="30" y="${y - 18}" width="224" height="24" rx="7" fill="${active ? '#172554' : 'transparent'}"/>
    <circle cx="44" cy="${y - 6}" r="4" fill="${active ? '#38bdf8' : '#475569'}"/>
    <text x="58" y="${y - 1}" class="side" fill="${active ? '#7dd3fc' : '#cbd5e1'}">${escapeXml(truncate(name.replace('remotes/', ''), 27))}</text>`;
}).join('\n');

const filesChanged = statusLines.length;
const statusSummary = filesChanged === 0 ? 'Working tree clean' : `${filesChanged} changed file${filesChanged > 1 ? 's' : ''}`;
const fileRows = statusLines.slice(0, 9).map((line, index) => {
  const status = line.slice(0, 2).trim() || 'M';
  const path = line.slice(3);
  const y = 190 + index * 32;
  return `<rect x="1110" y="${y - 20}" width="292" height="27" rx="7" fill="#111827"/>
    <text x="1123" y="${y - 2}" class="tiny" fill="#38bdf8">${escapeXml(status)}</text>
    <text x="1153" y="${y - 2}" class="side">${escapeXml(truncate(path, 31))}</text>`;
}).join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#070b16"/><stop offset="1" stop-color="#0f172a"/></linearGradient>
    <style>
      text { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .title { font-size: 22px; font-weight: 800; fill: #f8fafc; }
      .sub { font-size: 13px; fill: #94a3b8; }
      .label { font-size: 11px; font-weight: 800; letter-spacing: .12em; fill: #64748b; }
      .side { font-size: 13px; fill: #cbd5e1; }
      .msg { font-size: 14px; fill: #e2e8f0; font-weight: 650; }
      .meta, .tiny { font-size: 11px; fill: #94a3b8; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${width}" height="58" fill="#0d1324" stroke="#1e293b"/>
  <circle cx="32" cy="29" r="12" fill="#38bdf8"/><path d="M27 29h10M32 24v10" stroke="#07111f" stroke-width="3" stroke-linecap="round"/>
  <text x="58" y="37" class="title">GitPilot</text>
  <text x="180" y="36" class="sub">${escapeXml(repoName)} · ${escapeXml(branch)} · deterministic CI preview</text>
  <rect x="1130" y="16" width="92" height="27" rx="8" fill="#0f2a44" stroke="#38bdf855"/><text x="1150" y="34" class="side" fill="#7dd3fc">Fetch</text>
  <rect x="1232" y="16" width="78" height="27" rx="8" fill="#172554" stroke="#38bdf855"/><text x="1254" y="34" class="side" fill="#7dd3fc">Pull</text>
  <rect x="1320" y="16" width="78" height="27" rx="8" fill="#38bdf8"/><text x="1344" y="34" class="side" fill="#06101e">Push</text>

  <rect x="0" y="58" width="280" height="${height - 198}" fill="#0a0f1e" stroke="#1e293b"/>
  <text x="28" y="100" class="label">REPOSITORY</text>
  <text x="28" y="126" class="title">${escapeXml(repoName)}</text>
  <text x="28" y="152" class="sub">${escapeXml(statusSummary)}</text>
  <text x="28" y="176" class="label">LOCAL BRANCHES</text>
  ${branchRows}

  <rect x="280" y="58" width="810" height="${height - 198}" fill="#090e1b" stroke="#1e293b"/>
  <text x="316" y="100" class="label">COMMIT GRAPH · ${commits.length} COMMITS</text>
  <rect x="760" y="78" width="292" height="30" rx="8" fill="#020617" stroke="#1e293b"/>
  <text x="780" y="98" class="sub">Search message, hash, author, branch…</text>
  ${rows}

  <rect x="1090" y="58" width="350" height="${height - 198}" fill="#080d19"/>
  <text x="1120" y="100" class="label">WORKTREE</text>
  <text x="1120" y="128" class="title">${escapeXml(statusSummary)}</text>
  <text x="1120" y="160" class="label">FILES</text>
  ${fileRows || '<text x="1120" y="196" class="side">No local changes</text>'}

  <rect x="0" y="${height - 140}" width="${width}" height="140" fill="#020617" stroke="#1e293b"/>
  <text x="28" y="${height - 102}" class="label">GIT OUTPUT · VALIDATION · PROBLEMS · AI</text>
  <text x="28" y="${height - 70}" class="sub">CI screenshot generated from the current repository without launching a browser window.</text>
  <text x="28" y="${height - 44}" class="sub">This deterministic preview avoids black frames and stuck headless browser captures.</text>
</svg>`;

await writeFile(output, svg, 'utf8');
console.log(`Wrote ${output}`);
