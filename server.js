const http = require('http');
const PORT = process.env.PORT || 8080;

const MAX = 500;
const hits = [];

function record(req, body) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket.remoteAddress || '?';
  const e = {
    t: new Date().toISOString(),
    ip,
    host: req.headers.host || '',
    method: req.method,
    path: req.url,
    ua: req.headers['user-agent'] || '',
    ref: req.headers.referer || req.headers.referrer || '',
    lang: req.headers['accept-language'] || '',
    country: req.headers['cf-ipcountry'] || '',
    body: body || ''
  };
  hits.push(e);
  if (hits.length > MAX) hits.shift();
  console.log('HIT ' + JSON.stringify(e));
  return e;
}

const PAGE = (e) => `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e.host}</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;font:15px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;background:#0b0d10;color:#d7dde5}
.wrap{max-width:820px;margin:0 auto;padding:40px 24px 64px}
.badge{display:inline-block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7ee2a8;border:1px solid #1f3b2c;background:#0f1a15;padding:5px 10px;border-radius:999px}
h1{font-size:26px;margin:18px 0 6px;font-weight:600;letter-spacing:-.02em}
.sub{color:#7b8798;margin:0 0 28px}
table{width:100%;border-collapse:collapse;font-size:13px}
td{padding:9px 0;border-bottom:1px solid #1a1f26;vertical-align:top}
td:first-child{color:#6f7c8d;width:130px}
td:last-child{color:#e8eef6;word-break:break-all}
.host{color:#ffb86b}
.note{margin-top:28px;font-size:12.5px;color:#5f6b7a;line-height:1.7}
a{color:#79b8ff;text-decoration:none}
</style></head><body><div class="wrap">
<span class="badge">захвачено</span>
<h1>${e.host}</h1>
<p class="sub">Домен указывает на сервер, которым управляет не владелец домена.</p>
<table>
<tr><td>host</td><td class="host">${e.host}</td></tr>
<tr><td>path</td><td>${e.path}</td></tr>
<tr><td>IP</td><td>${e.ip}</td></tr>
<tr><td>referer</td><td>${e.ref || '—'}</td></tr>
<tr><td>user-agent</td><td>${e.ua || '—'}</td></tr>
<tr><td>язык</td><td>${e.lang || '—'}</td></tr>
<tr><td>время UTC</td><td>${e.t}</td></tr>
</table>
<div class="note">
Записано в журнал сервера.<br>
Визитов с этого домена: <b>${hits.filter(h => h.host === e.host).length}</b><br><br>
<a href="/log">весь журнал →</a>
</div></div></body></html>`;

http.createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(200); return res.end('ok'); }

  if (req.url.startsWith('/log')) {
    const host = req.headers.host || '';
    const rows = hits.slice().reverse();
    if (req.url.startsWith('/log/json') || (req.headers.accept || '').includes('application/json')) {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify(rows, null, 1));
    }
    const body = `<!doctype html><meta charset="utf-8"><title>журнал</title>
<style>body{background:#0b0d10;color:#d7dde5;font:13px/1.6 ui-monospace,Menlo,monospace;margin:0;padding:32px}
h1{font-size:18px;font-weight:600}table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #1a1f26;vertical-align:top}
th{color:#6f7c8d;font-weight:500;background:#0b0d10}
td.ip{color:#ffb86b}td.ref{color:#79b8ff;max-width:280px;word-break:break-all}</style>
<h1>журнал · ${rows.length} записей</h1>
<table><tr><th>время UTC</th><th>host</th><th>path</th><th>ip</th><th>referer</th><th>ua</th></tr>
${rows.map(h => `<tr><td>${h.t.slice(0,19)}</td><td>${h.host}</td><td>${h.path}</td><td class="ip">${h.ip}</td><td class="ref">${h.ref || '—'}</td><td>${(h.ua||'').slice(0,42)}</td></tr>`).join('')}
</table>`;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(body);
  }

  if (req.method === 'POST' || req.url.startsWith('/beacon')) {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 4000) req.destroy(); });
    req.on('end', () => {
      record(req, b.slice(0, 2000));
      res.writeHead(204, { 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
      res.end();
    });
    return;
  }

  const e = record(req);
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
    'expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
  });
  res.end(PAGE(e));
}).listen(PORT, () => console.log('listening on ' + PORT));
