# 会議メモ → 議事録 & アクションアイテム（Claude Fable 5.1 デモ）

雑な会議メモを貼ると、Claude Fable 5.1 が **要約 / 決定事項 / アクションアイテム（担当・期限・優先度）/ 未解決の論点 / Issue 下書き** を JSON スキーマ通りに生成し、画面にカード表示します。
モデルの思考要約（thinking summary）と JSON 生成をリアルタイムでストリーミング表示します。

## 起動方法

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # 任意。無ければデモモード or 画面から入力
npm start
# → http://localhost:3000
```

## API キーの渡し方（3通り）

| 方法 | やり方 | 向いている場面 |
|---|---|---|
| 環境変数 | `export ANTHROPIC_API_KEY=sk-ant-...` してから `npm start` | 自分のPCでのデモ |
| 画面の入力欄 | 起動後、画面の「API キー」欄に貼り付け | 会場で借りたキーを使う時 |
| なし | 何もしない | デモモード（API を呼ばず簡易解析の結果を返す） |

画面から入れたキーは、サーバーには保存されず、リクエストごとに `x-api-key` ヘッダーで送られます（ブラウザの localStorage にのみ残ります）。

## API キーの取得方法

1. https://console.anthropic.com にアクセスし、アカウントを作成（Google アカウントまたはメール）。
2. 左メニューの **Billing** でクレジットを購入（前払い制。$5 程度から）。
3. 左メニューの **API Keys** → **Create Key** → 名前を付けて作成。
4. 表示された `sk-ant-api03-...` を**その場でコピー**（後から再表示はできません）。
5. 上記のいずれかの方法でアプリに渡す。

Fable 5.1 は 30 日間のデータ保持設定が必要なため、ゼロデータ保持（ZDR）契約の組織では 400 エラーになります。その場合はモデルを `claude-opus-5` に変えてください（`server.js` の `MODEL`）。

## 使っている Fable 5.1 の機能

- `output_config.format`（structured outputs）で議事録の JSON スキーマを強制
- `thinking: { type: "adaptive", display: "summarized" }` で思考要約をストリーミング
- `output_config.effort`（low / medium / high / xhigh）を画面から切替
- `fallbacks` で安全分類器による refusal 時に Opus 4.8 へ自動フォールバック

## 構成

- `server.js` — Express。`POST /api/minutes` が SSE でストリーミング応答
- `public/index.html` — 画面（1ファイル、依存なし）
