import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import app from './dist/server/server.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const clientDir = resolve(process.cwd(), 'dist', 'client');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function trySendStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = normalize(pathname.replace(/^\/+/, ''));
  const filePath = join(clientDir, relativePath);

  if (!filePath.startsWith(`${clientDir}${sep}`) || !existsSync(filePath)) {
    return false;
  }

  res.statusCode = 200;
  res.setHeader('content-type', contentTypes[extname(filePath)] || 'application/octet-stream');
  res.setHeader('cache-control', pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300');

  if (req.method === 'HEAD') {
    res.end();
    return true;
  }

  createReadStream(filePath).pipe(res);
  return true;
}

function getProtocol(req) {
  const forwarded = req.headers['x-forwarded-proto'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return req.socket.encrypted ? 'https' : 'http';
}

function toWebRequest(req) {
  const hostHeader = req.headers.host || `${host}:${port}`;
  const url = new URL(req.url || '/', `${getProtocol(req)}://${hostHeader}`);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const init = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = Readable.toWeb(req);
    init.duplex = 'half';
  }

  return new Request(url, init);
}

async function sendWebResponse(res, webResponse) {
  res.statusCode = webResponse.status;
  res.statusMessage = webResponse.statusText;

  const setCookies =
    typeof webResponse.headers.getSetCookie === 'function'
      ? webResponse.headers.getSetCookie()
      : [];

  for (const [key, value] of webResponse.headers) {
    if (key.toLowerCase() !== 'set-cookie') {
      res.setHeader(key, value);
    }
  }

  if (setCookies.length > 0) {
    res.setHeader('set-cookie', setCookies);
  }

  if (!webResponse.body) {
    res.end();
    return;
  }

  Readable.fromWeb(webResponse.body).pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    if (trySendStatic(req, res)) return;

    const response = await app.fetch(toWebRequest(req), process.env, {
      waitUntil: () => {},
      passThroughOnException: () => {},
    });
    await sendWebResponse(res, response);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Internal Server Error');
  }
});

server.listen(port, host, () => {
  console.log(`HEPA Connect listening on http://${host}:${port}`);
});
