// 会議メモ → 議事録 & アクションアイテム 自動生成 (Claude Fable 5.1 デモ)
// 起動: ANTHROPIC_API_KEY=sk-ant-... npm start  → http://localhost:3000
// キーが無い場合はデモモード（API を呼ばずにダミー結果を返す）で動きます。
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const MODEL = "claude-fable-5-1";

// Fable 5.1 に返させる議事録の JSON スキーマ（structured outputs）
const MINUTES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "decisions", "action_items", "open_questions", "issue_drafts"],
  properties: {
    title: { type: "string", description: "会議タイトル（メモから推測）" },
    summary: { type: "string", description: "3〜5文の要約" },
    decisions: { type: "array", items: { type: "string" }, description: "決定事項" },
    action_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["task", "owner", "due", "priority"],
        properties: {
          task: { type: "string" },
          owner: { type: "string", description: "担当者。不明なら '未定'" },
          due: { type: "string", description: "期限。不明なら '未定'" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    open_questions: { type: "array", items: { type: "string" }, description: "未解決の論点" },
    issue_drafts: {
      type: "array",
      description: "GitHub / Linear にそのまま起票できる Issue 下書き",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body"],
        properties: { title: { type: "string" }, body: { type: "string" } },
      },
    },
  },
};

const SYSTEM_PROMPT = `あなたは優秀なプロジェクトマネージャーです。雑然とした会議メモから、
議事録（要約・決定事項・アクションアイテム・未解決の論点）と、そのまま起票できる Issue 下書きを日本語で作成します。
メモに書かれていない担当者や期限を捏造せず、不明なら「未定」としてください。`;

app.get("/api/status", (_req, res) => {
  res.json({ model: MODEL, hasServerKey: Boolean(process.env.ANTHROPIC_API_KEY) });
});

app.post("/api/minutes", async (req, res) => {
  const notes = String(req.body?.notes ?? "").trim();
  const effort = ["low", "medium", "high", "xhigh"].includes(req.body?.effort) ? req.body.effort : "medium";
  const apiKey = req.get("x-api-key") || process.env.ANTHROPIC_API_KEY;
  if (!notes) return res.status(400).json({ error: "notes is required" });

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  if (!apiKey) {
    await demoStream(notes, send);
    return res.end();
  }

  const client = new Anthropic({ apiKey });
  const started = Date.now();
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      // Fable 5.1 は thinking 常時オン。要約表示を有効にして UI に流す。
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort, format: { type: "json_schema", schema: MINUTES_SCHEMA } },
      // 安全分類器で refusal になった場合は Opus 4.8 に自動フォールバック
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      messages: [{ role: "user", content: `以下の会議メモを議事録にしてください。\n\n<notes>\n${notes}\n</notes>` }],
    });

    for await (const event of stream) {
      if (event.type !== "content_block_delta") continue;
      if (event.delta.type === "thinking_delta") send("thinking", { text: event.delta.thinking });
      else if (event.delta.type === "text_delta") send("json", { text: event.delta.text });
    }

    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      send("error", { message: `モデルが応答を拒否しました (${message.stop_details?.category ?? "unknown"})` });
      return res.end();
    }
    const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const servedBy = message.content.find((b) => b.type === "fallback")?.to?.model ?? message.model;
    send("done", {
      result: JSON.parse(text),
      meta: {
        model: servedBy,
        effort,
        ms: Date.now() - started,
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
        demo: false,
      },
    });
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : undefined;
    send("error", { message: `${status ? status + ": " : ""}${err.message}` });
  }
  res.end();
});

// ---- デモモード（API キーなし）：メモを素朴に解析してそれっぽい結果を返す ----
async function demoStream(notes, send) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const allLines = notes.split(/\r?\n/).map((l) => l.replace(/^[-*・\s]+/, "").trim()).filter(Boolean);
  const isTask = (l) => /(する|やる|対応|確認|作成|準備|調査|TODO|todo|→)/.test(l);
  const isDecision = (l) => /(決定|決まり|採用|にする|で行く|でいく|合意)/.test(l);
  const isQuestion = (l) => /(\?|？|要検討|どうする|保留)/.test(l);
  // 1行目がタスクでも決定でもなければ会議タイトルとして扱う
  const looksLikeTitle = (l) => /(MTG|mtg|会議|定例|ミーティング|打ち?合わ?せ|振り返り|キックオフ)/.test(l) || (!isTask(l) && !isDecision(l));
  const hasTitle = allLines.length > 1 && looksLikeTitle(allLines[0]);
  const title = hasTitle ? allLines[0] : "会議";
  const lines = hasTitle ? allLines.slice(1) : allLines;
  const owner = (l) => (l.match(/([一-龥]{1,4}|[ァ-ヶー]{2,6}|[A-Za-z]{2,10})(さん|くん|氏)/)?.[1] ?? "未定");
  const due = (l) => (l.match(/(\d{1,2}\/\d{1,2}|来週|今週|明日|月末|\d+日まで)/)?.[1] ?? "未定");
  const priority = (l) => (/(至急|明日|今週|必須)/.test(l) ? "high" : /(時間があれば|優先度低|余裕があれば)/.test(l) ? "low" : "medium");

  for (const t of ["メモを読み込み中…", "決定事項とタスクを分類しています…", "Issue 下書きを組み立てています…"]) {
    send("thinking", { text: `[デモ] ${t}\n` });
    await sleep(350);
  }
  const decisions = lines.filter(isDecision);
  const open_questions = lines.filter((l) => isQuestion(l) && !isDecision(l));
  const action_items = lines
    .filter((l) => isTask(l) && !isDecision(l) && !isQuestion(l))
    .map((l) => ({ task: l, owner: owner(l), due: due(l), priority: priority(l) }));
  const result = {
    title,
    summary: `（デモモード：API キー未設定のため Fable 5.1 は呼んでいません）${lines.length} 行のメモから、決定事項 ${decisions.length} 件・タスク ${action_items.length} 件・未解決 ${open_questions.length} 件を抽出しました。`,
    decisions,
    action_items,
    open_questions,
    issue_drafts: action_items.slice(0, 3).map((a) => ({ title: a.task, body: `担当: ${a.owner}\n期限: ${a.due}\n\n元メモ:\n${notes.slice(0, 200)}` })),
  };
  const json = JSON.stringify(result, null, 2);
  for (let i = 0; i < json.length; i += 40) {
    send("json", { text: json.slice(i, i + 40) });
    await sleep(15);
  }
  send("done", { result, meta: { model: "demo (no API key)", effort: "-", ms: 0, input_tokens: 0, output_tokens: 0, demo: true } });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`▶ http://localhost:${PORT}  (model: ${MODEL}, key: ${process.env.ANTHROPIC_API_KEY ? "env" : "none → demo mode / UI input"})`));
