(() => {
  if (!/web\.okjike\.com$/i.test(location.hostname)) {
    alert("Please open web.okjike.com first.");
    return;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const now = () => new Date().toISOString();

  const state = {
    startedAt: now(),
    responses: [],
    parseErrors: 0,
    debug: {
      snapshots: 0,
      domBlocks: 0,
    },
  };

  const originalFetch = window.fetch;
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  const normalizeText = (text) => String(text || "").replace(/\s+/g, " ").trim();

  const isLikelyJson = (text) => {
    if (!text || typeof text !== "string") return false;
    const s = text.trim();
    return s.startsWith("{") || s.startsWith("[");
  };

  const captureResponse = (source, url, status, text) => {
    if (!isLikelyJson(text)) return;
    try {
      const body = JSON.parse(text);
      state.responses.push({
        source,
        url: String(url || ""),
        status: Number(status || 0),
        capturedAt: now(),
        body,
      });
    } catch (_err) {
      state.parseErrors += 1;
    }
  };

  window.fetch = async (...args) => {
    const res = await originalFetch(...args);
    try {
      const cloned = res.clone();
      const text = await cloned.text();
      const reqUrl = (args && args[0] && args[0].url) || args[0] || "";
      captureResponse("fetch", reqUrl, res.status, text);
    } catch (_err) {}
    return res;
  };

  XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
    this.__okjikeUrl = url;
    return originalXhrOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function send(body) {
    this.addEventListener("loadend", () => {
      try {
        if (this.responseType && this.responseType !== "" && this.responseType !== "text") {
          if (this.responseType === "json" && this.response) {
            captureResponse("xhr", this.__okjikeUrl, this.status, JSON.stringify(this.response));
          }
          return;
        }
        captureResponse("xhr", this.__okjikeUrl, this.status, this.responseText);
      } catch (_err) {}
    });
    return originalXhrSend.call(this, body);
  };

  const readByPath = (obj, path) =>
    path
      .split(".")
      .reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), obj);

  const firstString = (obj, paths) => {
    for (const path of paths) {
      const v = readByPath(obj, path);
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
    return "";
  };

  const toText = (obj) =>
    firstString(obj, [
      "content",
      "text",
      "title",
      "message.content",
      "data.content",
      "question.content",
      "answer.content",
      "note.content",
      "payload.content",
      "payload.text",
      "post.content",
      "post.text",
      "brief",
      "description",
    ]);

  const toDate = (obj) =>
    firstString(obj, [
      "createdAt",
      "created",
      "created_at",
      "publishTime",
      "publishedAt",
      "time",
      "date",
      "updatedAt",
      "mtime",
      "ctime",
      "meta.createdAt",
    ]);

  const toUrl = (obj) =>
    firstString(obj, [
      "url",
      "shareLink",
      "shareUrl",
      "jumpUrl",
      "permalink",
      "uri",
      "link",
      "post.url",
    ]);

  const toId = (obj) =>
    firstString(obj, [
      "id",
      "postId",
      "entityId",
      "itemId",
      "originalPost.id",
      "object.id",
      "post.id",
      "messageId",
    ]);

  const toAuthor = (obj) =>
    firstString(obj, [
      "user.screenName",
      "user.nickname",
      "author.name",
      "author.nickname",
      "owner.name",
      "owner.nickname",
      "publisher.nickname",
      "publisher.name",
    ]);

  const toTopic = (obj) =>
    firstString(obj, [
      "topic.name",
      "community.name",
      "category.name",
      "tag.name",
      "topicTitle",
    ]);

  const walk = (node, visit, seen = new WeakSet()) => {
    if (!node || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    visit(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item, visit, seen);
      return;
    }
    for (const v of Object.values(node)) walk(v, visit, seen);
  };

  const looksLikePost = (obj) => {
    const text = normalizeText(toText(obj));
    const date = toDate(obj);
    const id = toId(obj);
    const url = toUrl(obj);
    const hasUser = !!readByPath(obj, "user") || !!readByPath(obj, "author");
    if (text.length >= 8 && (date || id || url)) return true;
    if (text.length >= 16 && hasUser && (id || date)) return true;
    return false;
  };

  const normalizePost = (obj, source) => ({
    id: toId(obj),
    date: toDate(obj),
    author: toAuthor(obj),
    topic: toTopic(obj),
    content: normalizeText(toText(obj)),
    url: toUrl(obj),
    source,
  });

  const extractDateFromText = (text) => {
    const s = normalizeText(text);
    const patterns = [
      /\b(\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)\b/,
      /\b(\d{1,2}[\/.\-]\d{1,2}(?:\s+\d{1,2}:\d{2})?)\b/,
      /(\d{1,2}月\d{1,2}日(?:\s*\d{1,2}:\d{2})?)/,
      /(今天|昨天|前天|\d+\s*(?:分钟|小时|天)前)/,
    ];
    for (const re of patterns) {
      const m = s.match(re);
      if (m && m[1]) return m[1];
    }
    return "";
  };

  const extractIdFromElement = (el) => {
    if (!el) return "";
    const attrs = ["data-id", "data-key", "data-post-id", "id"];
    for (const key of attrs) {
      const v = el.getAttribute && el.getAttribute(key);
      if (v && /[a-z0-9\-]{8,}/i.test(v)) return v;
    }
    const a = el.querySelector && el.querySelector("a[href]");
    const href = (a && a.getAttribute("href")) || "";
    const m = href.match(/originalPosts\/([a-z0-9\-]+)/i) || href.match(/\/posts\/([a-z0-9\-]+)/i);
    return (m && m[1]) || "";
  };

  const collectFromResponses = () => {
    const rows = [];
    for (const resp of state.responses) {
      walk(resp.body, (obj) => {
        if (looksLikePost(obj)) rows.push(normalizePost(obj, `network:${resp.source}`));
      });
    }
    return rows;
  };

  const collectFromSnapshots = () => {
    const rows = [];
    const snapshots = [];

    const globalKeys = [
      "__NEXT_DATA__",
      "__NUXT__",
      "__INITIAL_STATE__",
      "__PRELOADED_STATE__",
      "__APOLLO_STATE__",
      "__STATE__",
      "__STORE__",
    ];

    for (const key of globalKeys) {
      try {
        if (window[key] && typeof window[key] === "object") snapshots.push({ source: `global:${key}`, body: window[key] });
      } catch (_err) {}
    }

    const scriptSelectors = [
      "script#__NEXT_DATA__",
      'script[type="application/json"]',
      'script[data-state]',
    ];

    for (const selector of scriptSelectors) {
      const scripts = Array.from(document.querySelectorAll(selector));
      for (const script of scripts) {
        const raw = (script.textContent || "").trim();
        if (!raw || raw.length < 100) continue;
        if (!isLikelyJson(raw)) continue;
        try {
          snapshots.push({ source: `script:${selector}`, body: JSON.parse(raw) });
        } catch (_err) {}
      }
    }

    try {
      for (const key of Object.keys(localStorage || {})) {
        if (!/(jike|apollo|redux|state|cache)/i.test(key)) continue;
        const raw = localStorage.getItem(key);
        if (!raw || raw.length < 100 || !isLikelyJson(raw)) continue;
        try {
          snapshots.push({ source: `localStorage:${key}`, body: JSON.parse(raw) });
        } catch (_err) {}
      }
    } catch (_err) {}

    state.debug.snapshots = snapshots.length;

    for (const snap of snapshots) {
      walk(snap.body, (obj) => {
        if (looksLikePost(obj)) rows.push(normalizePost(obj, snap.source));
      });
    }

    return rows;
  };

  const collectFromDom = () => {
    const rows = [];

    const root = document.querySelector("main") || document.body;
    const selectors = [
      "article",
      "[role='article']",
      "[role='listitem']",
      "main li",
      "main section",
      "main div",
      "a[href*='originalPosts']",
    ];

    const candidateSet = new Set();
    for (const selector of selectors) {
      for (const el of root.querySelectorAll(selector)) {
        if (!el || !(el instanceof HTMLElement)) continue;
        candidateSet.add(el);
      }
    }

    const timeRe = /\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}|\d{1,2}月\d{1,2}日|今天|昨天|前天|\d+\s*(分钟|小时|天)前/;
    const noiseRe = /(下载即刻|打开App|推荐用户|热门话题|隐私|服务条款|登录|注册)/i;

    for (const el of candidateSet) {
      if (el.closest("header,footer,nav,aside")) continue;

      const text = normalizeText(el.innerText || "");
      if (text.length < 20 || text.length > 5000) continue;
      if (noiseRe.test(text)) continue;

      const hasTime = timeRe.test(text);
      const hasPostLink = !!el.querySelector("a[href*='originalPosts'],a[href*='/posts/']");
      if (!hasTime && !hasPostLink) continue;

      const linkEl = el.querySelector("a[href]");
      const href = (linkEl && linkEl.href) || "";

      rows.push({
        id: extractIdFromElement(el),
        date: extractDateFromText(text),
        author: "",
        topic: "",
        content: text,
        url: href,
        source: "dom:block",
      });
    }

    state.debug.domBlocks = rows.length;
    return rows;
  };

  const dedupe = (rows) => {
    const map = new Map();
    for (const row of rows) {
      if (!row || !normalizeText(row.content)) continue;
      const key =
        normalizeText(row.id) ||
        normalizeText(row.url) ||
        `${normalizeText(row.date).slice(0, 20)}|${normalizeText(row.content).slice(0, 120)}`;
      if (!key) continue;

      const incoming = {
        id: normalizeText(row.id),
        date: normalizeText(row.date),
        author: normalizeText(row.author),
        topic: normalizeText(row.topic),
        content: normalizeText(row.content),
        url: normalizeText(row.url),
        source: normalizeText(row.source),
      };

      if (!map.has(key)) {
        map.set(key, incoming);
        continue;
      }

      const old = map.get(key);
      if ((!old.date && incoming.date) || (!old.url && incoming.url) || old.source.startsWith("dom")) {
        map.set(key, { ...old, ...incoming });
      }
    }
    return Array.from(map.values());
  };

  const toCsv = (rows) => {
    const headers = ["id", "date", "author", "topic", "content", "url", "source"];
    const esc = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
    const lines = [headers.join(",")];
    for (const row of rows) {
      lines.push(headers.map((h) => esc(row[h])).join(","));
    }
    return lines.join("\n");
  };

  const download = (filename, content, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const findScrollableContainers = () => {
    const containers = [document.scrollingElement || document.documentElement, document.body];
    for (const el of document.querySelectorAll("main,section,div")) {
      if (!(el instanceof HTMLElement)) continue;
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const canScroll = (overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight + 200;
      if (canScroll) containers.push(el);
    }
    const seen = new Set();
    const deduped = [];
    for (const c of containers) {
      if (!c || seen.has(c)) continue;
      seen.add(c);
      deduped.push(c);
    }
    return deduped;
  };

  const autoScroll = async (maxRounds = 180, stableLimit = 10, pauseMs = 1100) => {
    let stableRounds = 0;
    let lastSig = "";

    for (let i = 1; i <= maxRounds; i += 1) {
      const containers = findScrollableContainers();
      for (const c of containers) {
        if (c === document.body || c === document.documentElement || c === document.scrollingElement) {
          window.scrollTo(0, document.body.scrollHeight);
        } else if (c && typeof c.scrollTo === "function") {
          c.scrollTo({ top: c.scrollHeight, behavior: "auto" });
        }
      }

      await sleep(pauseMs);

      const sig = findScrollableContainers()
        .map((c) => `${c.scrollHeight}:${c.scrollTop || 0}`)
        .join("|");

      const cardCount = document.querySelectorAll("article,[role='article'],[role='listitem'],a[href*='originalPosts']").length;
      console.log(`[Jike Export] round=${i}, cards=${cardCount}, sig=${sig.slice(0, 80)}...`);

      if (sig === lastSig) stableRounds += 1;
      else stableRounds = 0;
      lastSig = sig;

      if (stableRounds >= stableLimit) break;
    }
  };

  const restore = () => {
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXhrOpen;
    XMLHttpRequest.prototype.send = originalXhrSend;
  };

  const run = async () => {
    try {
      console.log("[Jike Export] start");
      console.log("[Jike Export] tip: open your /me page first for best result.");

      await autoScroll();

      const networkRows = collectFromResponses();
      const snapshotRows = collectFromSnapshots();
      const domRows = collectFromDom();

      const rows = dedupe([...networkRows, ...snapshotRows, ...domRows]).sort((a, b) =>
        String(a.date || "").localeCompare(String(b.date || ""))
      );

      const bySource = rows.reduce((acc, row) => {
        const key = row.source || "unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const payload = {
        meta: {
          profileUrl: location.href,
          exportedAt: now(),
          networkResponseCount: state.responses.length,
          parseErrors: state.parseErrors,
          snapshotCount: state.debug.snapshots,
          domBlockCount: state.debug.domBlocks,
          rowCount: rows.length,
          sourceStats: bySource,
        },
        posts: rows,
      };

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      download(`jike-export-${stamp}.json`, JSON.stringify(payload, null, 2), "application/json");
      download(`jike-export-${stamp}.csv`, toCsv(rows), "text/csv;charset=utf-8");

      console.log("[Jike Export] done", payload.meta);
      console.table(rows.slice(0, 20));

      if (!rows.length) {
        alert(
          "Export finished but still empty. Please open https://web.okjike.com/me and rerun after manual scrolling for 10s."
        );
      } else {
        alert(`Export finished. Rows: ${rows.length}. JSON + CSV downloaded.`);
      }
    } finally {
      restore();
    }
  };

  run().catch((err) => {
    restore();
    console.error("[Jike Export] failed", err);
    alert(`Export failed: ${err && err.message ? err.message : err}`);
  });
})();
