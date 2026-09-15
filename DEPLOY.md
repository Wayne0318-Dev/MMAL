# 上线操作步骤（关电脑也能查）

目标：得到一个 `https://……vercel.app` 网址。车间电脑关机、换手机、换电脑都能打开查询。新月份表格从网站导入后保存在云库，不会丢。

需要三个免费账号，都建议用 **同一个 GitHub 账号** 登录：

1. GitHub（放代码）
2. Turso（放表格和汇总）
3. Vercel（放网站）

我这边不能替你点注册。按下面顺序做完，把 Vercel 网址发回来，我可以帮你看第一次打开是否正常。

---

## 第 0 步：准备一张纸或备忘录

后面要抄三样东西，不要截图发到公开群：

| 抄下来的名字 | 从哪里来 | 填到哪里 |
| --- | --- | --- |
| Database URL（`libsql://…`） | Turso | Vercel 环境变量 `TURSO_DATABASE_URL` |
| Auth Token（一长串） | Turso | Vercel 环境变量 `TURSO_AUTH_TOKEN` |
| 导入口令（你自己定） | 自己想一个 | Vercel 环境变量 `IMPORT_KEY` |

导入口令例子：车间里只有负责导入的人知道的一句话或一串字母数字。查询不用这个口令。

---

## 第 1 步：把代码放到 GitHub

1. 打开这个项目在 Cursor 里的页面。
2. 点 **Create repo**（创建仓库）。公开或私有都可以。
3. 等它显示仓库已经建好。Vercel 只能从 GitHub 拉代码，这一步不做完，后面选不到这个项目。

如果已经有 GitHub 仓库，跳过本步。

---

## 第 2 步：建免费 Turso 库（网页，不用装软件）

### 2.1 注册并登录

1. 浏览器打开 https://app.turso.tech
2. 用 **GitHub** 登录（第一次会跳到 GitHub 授权，点允许）。
3. 如果问组织名 / 个人空间，用默认即可。

### 2.2 新建数据库

1. 进仪表盘后点 **Create Database** / **New Database** / **创建数据库**（按钮文案可能略有不同）。
2. 数据库名字填：`mold-machine`（只能小写、数字、短横线）。
3. 引擎选 **libSQL**。不要选带 `--tursodb` / TursoDB 那种新引擎；本项目用的是 libSQL 连接。
4. 地区选离你最近的即可（例如 `singapore` / `tokyo`）。
5. 创建。等状态变成 Ready / 可用。

### 2.3 复制 URL

1. 点开刚建的 `mold-machine`。
2. 找到 **Connect** / **URL** / **Database URL**。
3. 复制以 `libsql://` 开头的那一行，整行粘到备忘录。
   - 对的例子：`libsql://mold-machine-你的组织名.turso.io`
   - 不要用只含 `https://` 且末尾带 `/v2/pipeline` 的 HTTP 接口地址。

### 2.4 生成 Token

1. 同一页找 **Tokens** / **Create Token** / **Auth Token**。
2. 权限选 **Read and write** / **full-access** / 读写（不要只读）。
3. 过期时间选 **Never** / **不过期**（没有这项就选最长）。
4. 生成后立刻复制整串 Token 到备忘录。页面关掉后再找可能要重新生成。

### 2.5 如果网页里找不到 URL / Token

在本机终端执行（需先安装 [Turso CLI](https://docs.turso.tech/cli)）：

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
turso db create mold-machine
turso db show mold-machine --url
turso db tokens create mold-machine
```

`show --url` 打出的是 Database URL，`tokens create` 打出的是 Auth Token。  
不要加 `--tursodb`。

---

## 第 3 步：部署到 Vercel

### 3.1 登录并授权 GitHub

1. 打开 https://vercel.com
2. 点 **Sign Up** / **Log In**，选 **Continue with GitHub**。
3. 授权 Vercel 读取仓库。如果问范围，至少勾选刚创建的那个仓库。

### 3.2 导入项目

1. 登录后点 **Add New…** → **Project**。
2. 在列表里找到这个仓库，点右边的 **Import**。
3. Framework Preset 应自动识别为 **Next.js**，不要改。
4. Root Directory 保持默认（不要选子文件夹）。

### 3.3 填环境变量（Deploy 之前填）

在同一页往下找到 **Environment Variables**，逐条添加。每条都勾选 **Production**、**Preview**、**Development**（三个都勾）。

| Key（名称，必须一字不差） | Value（值） |
| --- | --- |
| `TURSO_DATABASE_URL` | 第 2 步的 `libsql://…` |
| `TURSO_AUTH_TOKEN` | 第 2 步的 Token |
| `IMPORT_KEY` | 你自己定的导入口令 |

注意：

- 名称不要多空格，不要写成 `TURSO_DATABASE_URL `。
- 值从备忘录整段粘贴，前后不要多空格或引号。
- 这三项都不要加 `NEXT_PUBLIC_` 前缀。

### 3.4 发布

1. 点 **Deploy**。
2. 等构建变绿（大约一两分钟）。变红把错误日志发回来。
3. 成功后点 **Visit** / **Continue to Dashboard**，复制 `https://……vercel.app` 网址。

若当时忘了填环境变量：打开项目 → **Settings** → **Environment Variables** 补上三项 → 再到 **Deployments** 最新一次右边菜单选 **Redeploy**（不要只刷新网页）。

---

## 第 4 步：第一次打开，确认数据在云端

1. 用手机或任意电脑打开那个 `vercel.app` 网址。
2. 点 **导入新表**。
3. 顶部提示应为 **数据在云端**。若仍写「数据在本机」，说明三项环境变量没生效，回到 3.3 补完后 Redeploy。
4. 首页应能查到 8 月、9 月已有模具（仓库里自带这两份表，第一次访问会写入 Turso）。
5. 查询不用口令。只有导入或删除表格时，才在「导入口令」框填写 `IMPORT_KEY`。

---

## 第 5 步：以后每个月怎么加表

1. 打开同一个 Vercel 网址。
2. 点 **导入新表**。
3. 填导入口令。
4. 选择当月 `.xlsx`。表头必须仍是：机台、机种品名、模具编号、上/下。
5. 文件名不要和已有文件完全相同，除非你就是要替换那一个月。同名会覆盖，不同名会累加。

车间电脑可以关机。数据在 Turso，网站在 Vercel。

---

## 常见卡住的地方

- **Vercel 列表里没有仓库**：第 1 步没建 GitHub 仓库，或授权时没勾这个仓库。到 Vercel → Settings → Git 重新授权。
- **构建成功但导入报错 / 仍显示本机**：环境变量没填、填错名、或填完没 Redeploy。
- **导入口令不对**：网站上填的必须和 Vercel 里 `IMPORT_KEY` 完全一致。
- **Token 过期或权限只读**：回 Turso 重新生成读写、不过期的 Token，更新 Vercel 变量后再 Redeploy。
- **不要**用 Vercel Blob、网盘、静态网页托管来存 xlsx。本项目只认 Turso 那两项变量。
