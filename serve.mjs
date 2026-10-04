import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8080);
// Local by default: the repo root holds .git and private research images. Set HOST=0.0.0.0 to share on a LAN.
export const HOST = process.env.HOST || '127.0.0.1';
const PRIVATE = [/(^|\/)\.[^/]/, /^docs\/research\/refs\//];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
};

export function createServer() {
  return http.createServer(async (req, res) => {
    let rel = '';
    try {
      const url = new URL(req.url, 'http://localhost');
      let file = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
      if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
      rel = path.relative(root, file).split(path.sep).join('/');
      if (PRIVATE.some((re) => re.test(rel))) { res.writeHead(403); return res.end(); }
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      const body = await readFile(file), { mtime } = await stat(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store',
        'content-length': body.length, 'last-modified': mtime.toUTCString() });
      res.end(body);
    } catch (err) {
      const missing = err.code === 'ENOENT' || err.code === 'ENOTDIR';
      // the player's own files in original/ are optional: not having one is no error worth a red line in the console
      if (missing && rel.startsWith('original/')) { res.writeHead(204); return res.end(); }
      res.writeHead(missing ? 404 : 500);
      res.end(String(err.code || err));
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(port, HOST, () => console.log(`Dune II 3D → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${port}`));
}
