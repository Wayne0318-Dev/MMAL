# 模具机台对照

输入模具编号，列出转模记录里实际对上过的机台。

只认 **机台编号 ↔ 模具编号**。机种名、上/下勾选只作备注。不按字母组联想其他机台。

## 本地运行

需要 Node.js 20+。

```bash
npm install
npm run data
npm run dev
```

本机打开 http://127.0.0.1:43127

未配置云数据库时，数据写在 `data/*.xlsx` 和 `src/data/dataset.json`。关电脑不影响本机已保存的文件，但别人打不开；在文件夹里删掉表格后，下一次重建查询会少那一份。

## 关电脑也能查、导入也不丢（免费）

把网站放到 [Vercel](https://vercel.com)（免费），表格和汇总放到 [Turso](https://turso.tech)（免费库）。部署完成后用 Vercel 给的 `https://……vercel.app` 访问，电脑关机也行。

### 1. 把代码放到 GitHub

若还没有仓库，在 Cursor 里点 **Create repo**，公开或私有均可。

### 2. 建一个免费 Turso 库

1. 打开 https://turso.tech 注册（可用 GitHub 登录）。
2. 新建一个数据库，例如 `mold-machine`。
3. 复制 **Database URL**（`libsql://…`）和 **Auth Token**。

命令行也可以：

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
turso db create mold-machine
turso db show mold-machine --url
turso db tokens create mold-machine
```

### 3. 部署到 Vercel

1. 打开 https://vercel.com ，用 GitHub 登录，Import 这个仓库。
2. 在 Project → Settings → Environment Variables 添加：

| 名称 | 值 |
| --- | --- |
| `TURSO_DATABASE_URL` | 上一步的 URL |
| `TURSO_AUTH_TOKEN` | 上一步的 Token |
| `IMPORT_KEY` | 自己设的导入口令（导入/删除表时用） |

3. Deploy。完成后打开 Vercel 给的网址。

第一次打开会把仓库里已有的 9 月份表写入云库。之后在「导入新表」里上传十月、十一月，数据留在 Turso，不依赖任何一台车间电脑。

查询不用口令；导入和删除要填 `IMPORT_KEY`。不要把口令写进代码或发给无关的人。

## 数据规则

- 新表表头需与现表相同：机台、机种品名、模具编号、上/下
- 工作表里要有「日期：YYYY 年 M 月 D 日」或表名如 `10.1`
- 同名文件再导入会替换该文件，不会把同一月加两遍

## 已确认规则

1. 上 = 上机，下 = 下机；勾选不是关联的必要条件。
2. 机台格空白 = 同一班次继承上一行机台。
3. 前模/后模是同一套模的两半，查询用主编号。
4. 一格多个不同模号 = 多套模，都关联到该机台。
5. Remo触屏支架编号为 S250137；Meridian支架缺号补 ZDX3464；S240127AB 记 S240127。
