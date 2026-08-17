# Claude Code 引継ぎガイド

## 1. 受け取ったZIPを展開する

```bash
unzip actuary-quest-claude-code.zip
cd actuary-quest
npm ci
```

WindowsではWSL上での実行を推奨します。

## 2. Claude CodeをPlan Modeで起動する

```bash
claude --permission-mode plan
```

リポジトリ直下に `CLAUDE.md` があるため、`/init` で作り直す必要はありません。

## 3. 最初に渡すプロンプト

以下をそのまま使えます。

```text
このリポジトリは、アクチュアリー試験「生保数理」の過去問演習Webアプリ ACTUARY QUEST です。

まずコードを変更せず、次を読んでください。

- CLAUDE.md
- README.md
- docs/PRODUCT_SPEC.md
- docs/ADDING_EXAM_CONTENT.md
- app/page.tsx
- app/guided/page.tsx
- app/guided/data.ts
- app/globals.css
- app/guided/guided.module.css

その上で、次を報告してください。

1. 現在の2つの学習モードと、それぞれの目的
2. 状態管理・採点・localStorage保存の仕組み
3. 数学的コンテンツを変更するときに壊してはいけない点
4. モバイルUX、アクセシビリティ、保守性の改善候補
5. 優先順位付きの改善計画

この段階ではファイルを変更しないでください。
全面リライトやフレームワーク移行は提案しないでください。
```

## 4. 実装を頼むときのテンプレート

レビュー後は、1回の依頼を一つの目的へ絞ります。

```text
CLAUDE.mdの制約を守って、次の変更を実装してください。

目的:
<実現したい学習体験>

対象:
<通常版 / 誘導版 / 両方>

必須要件:
- <要件1>
- <要件2>

変更しないもの:
- 問題文、正答、公式配点
- 既存localStorageデータ
- 対象外モードの挙動

実装前に短い方針を示し、実装後に npm run lint と npm run build を実行してください。
UI変更は360px前後の画面幅で主要フローを確認してください。
```

## 5. 数学的内容を頼むときの追加文

```text
正答・数式・誘導ステップを変更する前に、public/exam配下の公式問題画像と公式解答画像を読み、途中式を独立に検算してください。

通常版のcorrect、誘導版のfinalAnswer、各step.correctが一致することを確認してください。
誤答時のwrongHintには正答を直接書かず、典型的な誤解を一つだけ指摘してください。
```

## 6. 変更を受け取る方法

継続開発にはGitHubの非公開リポジトリが最も扱いやすいです。

```bash
git init
git add .
git commit -m "Initial ACTUARY QUEST handoff"
```

その後、ユーザー自身の非公開GitHubリポジトリへpushすれば、CodexとClaude Codeの両方が同じ履歴を引き継げます。

GitHubをまだ使わない場合は、変更後のフォルダをZIPにして受け渡しても構いません。その場合も `.git`、`node_modules`、`dist`、`.next`、`.sites-runtime` はZIPへ含める必要がありません。

## 7. Codexへ戻すとき

次のいずれかを渡してください。

- GitHubリポジトリURL
- Claude Codeが変更したZIP
- `git diff` のパッチ

併せて、Claude Codeが実行した検証結果と、未解決事項を伝えると再開が速くなります。

## 8. 最初の改善候補

現在の優先候補です。勝手に全部実装せず、1つずつ選びます。

1. 通常版・誘導版の共通問題メタデータを安全に一元化する
2. 現在の8問に対するデータ整合性テストを追加する
3. 途中再開を、既存保存データを壊さず追加する
4. 年度・大問を選べる試験セット構造へ拡張する
5. 誘導ステップごとの自由記述メモを追加する
6. 復習対象だけを再出題するモードを追加する

初回の改善としては、機能追加より先に「共通メタデータの一元化＋整合性テスト」が安全です。
