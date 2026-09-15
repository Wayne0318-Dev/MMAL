# 模具机台对照

根据《转模记录9月份.xlsx》（2026 年 9 月 1–14 日）查询：输入模具编号，列出这 14 天里实际对上过的机台。

只认 **机台编号 ↔ 模具编号**。机种名、上/下勾选只作备注。不按 A/B/C/D/E 字母组联想其他机台。

## 本地运行

需要 Node.js 20+。

```bash
npm install
npm run dev
```

浏览器打开 http://127.0.0.1:43127

## 数据

- 原始表：`data/转模记录9月份.xlsx`
- 解析结果：`src/data/dataset.json`
- 解析脚本：`scripts/build-dataset.py`

改过 Excel 或规则后：

```bash
pip install -r requirements.txt
npm run data
```

## 已确认规则

1. 上 = 上机，下 = 下机；勾选不是关联的必要条件。
2. 机台格空白 = 同一班次继承上一行机台。
3. 前模/后模是同一套模的两半，查询用主编号。
4. 一格多个不同模号 = 多套模，都关联到该机台。
5. Remo触屏支架编号为 S250137；Meridian支架缺号补 ZDX3464；S240127AB 记 S240127。
