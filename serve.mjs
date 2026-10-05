import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8080);
// Local by default: the repo root holds .git and private research images. Set HOST=0.0.0.0 to share on a LAN.
export const HOST = process.env.HOST || '127.0.0.1';
const PRIVATE = [/(^|\/)\.[^/]/, /^docs\/research\/refs\//];
// The type of each file the game serves: its pages and code, its pictures (the crests, portraits and results art are
// WebP) and sounds, and what a player may keep in original/ (their soundtrack as a .zip of VGM rips, or as audio files).
// Anything else (a .PAK, a .vgm) goes out as plain bytes, which is what it is.
export const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
  '.m4a': 'audio/mp4', '.weba': 'audio/webm', '.zip': 'application/zip',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};

/** A file's content type by its extension, in any letter case (a player's copy may be all capitals). */
export const contentType = (file) => TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';

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
      res.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store',
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
