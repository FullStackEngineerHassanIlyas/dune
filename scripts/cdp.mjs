// Minimal Chrome DevTools Protocol driver (no dependencies): launch headless Chrome with SwiftShader
// WebGL2, open pages, evaluate JS, send real mouse/keyboard input and capture screenshots.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BUTTONS = { none: 0, left: 1, right: 2, middle: 4 };

export async function launchChrome({ width = 1600, height = 900 } = {}) {
  const port = 9222 + Math.floor(Math.random() * 700);
  const userDir = await mkdtemp(path.join(tmpdir(), 'dune-chrome-'));
  const proc = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
    '--no-first-run', '--no-default-browser-check', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
    `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: 'ignore' });
  let version = null;
  for (let i = 0; i < 100 && !version; i++) {
    await sleep(100);
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { /* still starting */ }
  }
  if (!version) { proc.kill(); throw new Error('Chrome did not open its DevTools endpoint'); }
  return {
    port, width, height,
    async close() { proc.kill(); await sleep(300); await rm(userDir, { recursive: true, force: true }); },
  };
}

export async function openPage(chrome, url) {
  const target = await (await fetch(`http://127.0.0.1:${chrome.port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push(`[${msg.params.type}] ` + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      logs.push(`[exception] ${d.exception?.description || d.text}`);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: chrome.width, height: chrome.height, deviceScaleFactor: 1, mobile: false });
  const page = {
    logs,
    send,
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async waitFor(expression, timeoutMs = 30000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        try { if (await page.eval(expression)) return; } catch { /* page still loading */ }
        await sleep(100);
      }
      throw new Error(`timed out waiting for ${expression}\n${logs.join('\n')}`);
    },
    async screenshot(file) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(file, Buffer.from(r.data, 'base64'));
    },
    async mouse(type, x, y, { button = 'left', clickCount = 1, modifiers = 0, held = button } = {}) {
      const buttons = type === 'mouseReleased' ? 0 : BUTTONS[held] ?? 0;
      await send('Input.dispatchMouseEvent', { type, x, y, button, clickCount, modifiers, buttons });
    },
    async click(x, y, { button = 'left', modifiers = 0 } = {}) {
      await page.mouse('mouseMoved', x, y, { button: 'none', held: 'none', modifiers });
      await page.mouse('mousePressed', x, y, { button, modifiers });
      await page.mouse('mouseReleased', x, y, { button, modifiers });
    },
    async drag(x0, y0, x1, y1, steps = 10) {
      await page.mouse('mouseMoved', x0, y0, { button: 'none', held: 'none' });
      await page.mouse('mousePressed', x0, y0);
      for (let i = 1; i <= steps; i++) await page.mouse('mouseMoved', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, { button: 'left', held: 'left' });
      await page.mouse('mouseReleased', x1, y1);
    },
    async key(key, { code = key, modifiers = 0 } = {}) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers });
    },
    close() { ws.close(); },
  };
  return page;
}

export const MODIFIERS = { alt: 1, ctrl: 2, meta: 4, shift: 8 };
