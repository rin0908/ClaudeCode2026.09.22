# セットアップ手順（ハッカソン当日用）

所要時間の目安: 15 分（API キー取得 5 分 + 起動 3 分 + デモ練習 7 分）

---

## STEP 1. Anthropic API キーを取得する（5 分）

1. ブラウザで https://console.anthropic.com を開く。
2. 「Sign up」からアカウントを作る（Google アカウントでログインが最速）。
3. 左メニュー **Billing** → **Purchase credits** で前払いクレジットを買う（$5〜。Fable 5.1 は 1 回の議事録生成で数円〜十数円程度）。
4. 左メニュー **API Keys** → 右上 **Create Key**。
5. 名前（例: `hackathon`）を入れて **Create**。
6. 表示された `sk-ant-api03-...` を**その場でコピーして安全な場所に保存**する。この画面を閉じると二度と表示されない。

> 注意: キーを GitHub にコミットしない。`.env` や環境変数で渡す。

---

## STEP 2. このアプリを起動する（3 分）

前提: Node.js 18 以上が入っていること（`node -v` で確認）。

```bash
# 1. リポジトリを取得
git clone https://github.com/rin0908/ClaudeCode2026.09.22.git
cd ClaudeCode2026.09.22
git checkout claude/feble5-1-hackathon-l8jq4r   # このブランチに実装がある

# 2. 依存をインストール
npm install

# 3. API キーを環境変数にセット（Mac / Linux）
export ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxx
#    Windows (PowerShell) の場合:
#    $env:ANTHROPIC_API_KEY="sk-ant-api03-xxxxxxxx"

# 4. 起動
npm start
```

ターミナルに `▶ http://localhost:3000 (model: claude-fable-5-1, key: env)` と出れば成功。
ブラウザで http://localhost:3000 を開く。

### 環境変数を使わない場合

`export` を飛ばして `npm start` し、画面右上の「API キー」欄にキーを貼るだけでも動く。
キー欄も空のままなら**デモモード**（API を呼ばず簡易解析）で動く。

---

## STEP 3. デモの流れ（発表用）

1. 「サンプルメモを入れる」ボタンを押す（雑な箇条書きの会議メモが入る）。
2. effort を **low** にして「議事録を生成」。
   - 右側の「ライブ出力」に、Fable 5.1 の **思考の要約**（グレー斜体）→ **生成中の JSON** が流れる。
   - 完了すると下に議事録カード（決定事項 / アクションアイテム / 未解決の論点 / Issue 下書き）が出る。
3. 次に effort を **xhigh** にして再実行し、内容の深さと所要時間（メタ情報の ms）を比較して見せる。
4. 「Markdown をコピー」を押して、Notion や GitHub Issue にそのまま貼れることを見せる。
5. 自分たちのチームの実際のメモを貼って実演する。

### 話すポイント

- 出力は `output_config.format` で **JSON スキーマ強制**。パース失敗しないので UI に直接流せる。
- `thinking.display: "summarized"` で **思考の要約をストリーミング**。Fable 5.1 は思考が常時オン。
- `effort` で**推論の深さとコストをつまみ一つで調整**できる。
- 安全分類器で拒否された場合は `fallbacks` で **Opus 4.8 に自動フォールバック**。

---

## STEP 4. GitHub にプッシュできない時（Claude Code から 403 が出る場合）

Claude Code がこのリポジトリに書き込むには、GitHub 側で Claude App の許可が必要。

1. https://github.com/apps/claude/installations/select_target を開く。
2. 自分のアカウント（`rin0908`）を選ぶ。
3. 「Only select repositories」で `ClaudeCode2026.09.22` を選び **Install / Save**。
4. うまくいかなければ https://claude.ai/customize/connectors?auth_start=github&auth_start_force=1 から GitHub を再接続。
5. Claude Code のセッションに戻り「もう一度プッシュして」と伝える。

自分の PC から手動でプッシュする場合:

```bash
git push -u origin claude/feble5-1-hackathon-l8jq4r
```

---

## トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| `401 authentication_error` | キーが間違っている。コピーし直す。前後の空白に注意 |
| `400 invalid_request_error`（retention 関連） | 組織がゼロデータ保持設定。`server.js` の `MODEL` を `claude-opus-5` に変更 |
| `429 rate_limit_error` | 連打しすぎ。数十秒待つ |
| `モデルが応答を拒否しました` | 安全分類器が反応。メモの内容を変える（通常の会議メモでは起きない） |
| 画面が「デモモード」のまま | キーが渡っていない。ターミナルの起動ログの `key:` を確認 |
| ポート 3000 が使用中 | `PORT=3001 npm start` |
