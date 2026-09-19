// Зеркало Telegram Bot API для Render.
// С российского хостинга api.telegram.org недоступен, поэтому бот не мог
// ни ответить на «старт», ни прислать напоминание, ни уведомить о заявке.
// Сервис принимает наши запросы и передаёт их в Telegram как есть.
// Ключ обязателен: без него это открытый прокси к Telegram для кого угодно.
const http = require("http");

const UPSTREAM = "https://api.telegram.org";
const KEY = process.env.MIRROR_KEY || "";
const PORT = process.env.PORT || 10000;

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/" || url.pathname === "/health") {
    res.writeHead(KEY ? 200 : 500, { "content-type": "text/plain; charset=utf-8" });
    return res.end(KEY ? "ok" : "MIRROR_KEY не задан");
  }
  if (!KEY) { res.writeHead(500); return res.end("mirror not configured"); }
  if (req.headers["x-mirror-key"] !== KEY) { res.writeHead(403); return res.end("forbidden"); }
  if (!/^\/(bot|file\/bot)/.test(url.pathname)) { res.writeHead(404); return res.end("not found"); }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  const headers = { ...req.headers };
  delete headers["x-mirror-key"];
  delete headers.host;
  delete headers["content-length"];

  try {
    const upstream = await fetch(UPSTREAM + url.pathname + url.search, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
    });
    const out = {};
    upstream.headers.forEach((v, k) => {
      if (!["content-encoding", "content-length", "transfer-encoding"].includes(k)) out[k] = v;
    });
    res.writeHead(upstream.status, out);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, description: "mirror: " + String(e) }));
  }
}).listen(PORT, () => console.log("mirror on " + PORT));
