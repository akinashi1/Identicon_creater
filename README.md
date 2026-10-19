# Identicon Creator

任意の文字列から identicon を生成する静的サイトです。バックエンド・ビルド・依存ライブラリはありません（素の HTML / CSS / ES Modules のみ）。

## 機能

- 文字列を入力（またはランダム生成）すると、同じ文字列から常に同じアイコンを生成
- スタイル: GitHub 風（見た目を似せたもので、GitHub 本物のアルゴリズムではありません） / インベーダー / SSHアート（ssh-keygen のランダムアート風） / ピクセル / リング / ブロック / トライアングル / グラデーション
- 形（四角・角丸・円）、背景、色の固定、書き出しサイズを指定可能
- SVG / PNG の保存、SVG のコピー、設定込みの共有 URL（`#seed=...&style=...`）

## ローカルで試す

ES Modules を使うため、`file://` ではなく HTTP サーバー経由で開いてください。

```bash
python -m http.server 8123
```

http://localhost:8123 を開きます。

## GitHub Pages で公開する

1. リポジトリを GitHub に push
2. Settings → Pages → Source を `Deploy from a branch`、Branch を `main` / `/ (root)` にして保存

## スタイルを追加するには

`js/identicons.js` で `draw(r, colors, uid)` 関数（100x100 座標の SVG 断片を返す）を書き、`STYLES` 配列に追加すれば UI に自動で反映されます。`r()` は文字列から決まる 0〜1 の乱数です。

## 補足

GitHub の本物の identicon（ユーザー ID の MD5 ベース）とは同一ではなく、5x5 の左右対称という見た目を再現した「GitHub 風」です。
