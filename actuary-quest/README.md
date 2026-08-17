# ACTUARY QUEST

アクチュアリー試験「生保数理」の実際の過去問を、スマートフォンで反復できる学習ゲームです。

- 公開版: https://actuary-quest.nrok-chocolat.chatgpt.site
- 通常演習: `/`
- 初学者向け誘導演習: `/guided`

現在は、公益社団法人 日本アクチュアリー会の「2025年度 生保数理 問題2」全8問を収録しています。

## 2つの学習モード

### ACTUARY RAID `/`

過去問を本番と同じ形で解くモードです。

- 8問・公式配点56点
- 単一選択、2欄選択、複数選択に対応
- 問2の3点＋4点の部分点に対応
- 連続正解、速解き、ノーヒントのゲーム内加点
- 問題画像の拡大、公式解答表示
- 解答後の「詰まった箇所」メモとタグ
- ベストスコア、連続学習日数、メモを端末内へ保存

### GUIDED RAID `/guided`

過去問の難度を下げず、考える順番だけを小さく分解した初学者向けモードです。

- 全8問・合計37ステップ
- 方針、立式、計算、最終解答を一段ずつ選択
- 誤答時は正解を即表示せず、見るべき論点だけを提示
- 正答後に、その一段の意味を短く説明
- 問題別の理解度表示、クリア演出、進捗保存
- 最後に公式解答と照合

## Claude Codeで開発する

リポジトリ直下の [`CLAUDE.md`](./CLAUDE.md) をClaude Codeがセッション開始時に自動で読みます。最初に次の資料も確認してください。

- [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md): 現在の仕様と保存データ
- [`docs/ADDING_EXAM_CONTENT.md`](./docs/ADDING_EXAM_CONTENT.md): 年度・問題を追加する手順
- [`docs/CLAUDE_CODE_HANDOFF.md`](./docs/CLAUDE_CODE_HANDOFF.md): 初回起動と引継ぎ用プロンプト

推奨する最初の起動方法です。

```bash
claude --permission-mode plan
```

その後、`docs/CLAUDE_CODE_HANDOFF.md` のプロンプトを渡してください。

## ローカル起動

### 前提

- Node.js `>=22.13.0`
- npm
- LinuxまたはWSLを推奨

ビルド補助スクリプトがGNU `timeout`、`flock`、`curl`を使用するため、WindowsではWSLが最も確実です。

### セットアップ

```bash
npm ci
npm run dev
```

Viteが表示したローカルURLをブラウザで開きます。APIキーや外部データベースは不要です。

### 検証

```bash
npm run lint
npm run build
npm test
```

通常の変更では、まず `npm run lint` と `npm run build` を通してください。`npm test` はビルドに加えて、生成されたWorkerがHTMLを返せることも確認します。

## 主な構成

```text
app/
  page.tsx                    通常版の画面・問題定義・採点・端末保存
  globals.css                 通常版と全体のスタイル
  guided/
    page.tsx                  誘導版の画面・進行・端末保存
    data.ts                   誘導問題と全37ステップ
    guided.module.css         誘導版専用スタイル
public/exam/2025-q2/          公式問題・公式解答の画像
docs/                         製品仕様と開発引継ぎ資料
.openai/hosting.json          現在のOpenAI Sitesプロジェクト識別情報
```

## 技術構成

- TypeScript
- React 19
- Next.js App Router互換
- Vinext / Vite
- Cloudflare Worker互換の出力
- CSS / CSS Modules
- `localStorage` による端末内保存

バックエンド、ユーザーアカウント、外部APIは現在使用していません。

## 重要事項

- 問題文、正答、数式、誘導内容はUI都合で変更しないでください。
- `/` と `/guided` は別モードとして維持してください。
- 保存キーを変更すると既存ユーザーの端末内データが失われます。変更する場合は移行処理が必要です。
- `.openai/hosting.json`、既存のビルドスクリプト、ロックファイルは削除しないでください。
- 公式問題・解答画像の著作権や公開範囲は、外部公開を広げる前に別途確認してください。

より詳しい制約は `CLAUDE.md` を正とします。
