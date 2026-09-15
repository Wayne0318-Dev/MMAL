# 上线操作步骤（关电脑也能查）

目标：车间电脑关机、换手机、换电脑都能打开查询；新月份表格导入后不会丢。

有两条路：

- **方案 A（免费）**：GitHub + Turso + Vercel，得到 `https://……vercel.app`
- **方案 B（推荐给中国大陆车间）**：一台一直开机的香港/国内轻量服务器 + Docker。**不经过 GitHub。** 从大陆打开 GitHub、Vercel、Turso 经常失败时走这条。

---

## 中国大陆：GitHub 经常失败怎么办

GitHub 在大陆会超时、克隆失败、登录转圈，这是网络问题，不是这个项目坏了。

**车间日常查询根本不需要打开 GitHub。** GitHub 只在方案 A 第一次把代码交给 Vercel 时用一次。

可以改善、且不要做的事：

1. **Create repo 在 Cursor 里点**，不要用车间电脑打开 github.com 建仓库。Cursor 云端不在大陆，成功率高得多。
2. **绑定 Vercel 选一次网络较好的时段做完**（有时晚上、有时手机热点和公司宽带不一样）。绑定成功后，车间只收藏查询网址，不再进 GitHub。
3. **不要**把账号密码填进第三方「GitHub 加速站 / 镜像登录」。代码下载镜像也尽量别用来推送，口令会落到别人服务器上。
4. 代码想在国内留一份备份，可以用 [Gitee](https://gitee.com) 另存。Gitee **不能**替代 Vercel 对 GitHub 的连接，查询网站也不会自动从 Gitee 更新。
5. 若 `github.com`、`vercel.com`、`vercel.app`、`turso.tech` 经常打不开：直接走 **方案 B**。继续卡在 GitHub 上解决不了车间访问。

装 Node 依赖（方案 B 构建时）用国内镜像即可：

```bash
npm config set registry https://registry.npmmirror.com
```

---

## 方案 B：香港/国内轻量 + Docker

车间从大陆访问。不依赖 Vercel。域名不是必须的，用 `http://公网IP:43127` 即可。

### 腾讯云轻量（网页登录，不必从电脑上传文件夹）

镜像选 **Ubuntu24.04-Docker** 时，服务器已自带 Docker。代码优先在服务器上从 GitHub 拉取；只有 `git clone` 失败才改用压缩包上传。

1. 控制台左边点 **服务器** → 点开实例 → 点 **登录**（网页终端，不用装软件）。
2. 粘贴下面命令，整段一次回车（把导入口令换成你们自己的，不要用示例字）：

```bash
sudo apt-get update -y
sudo apt-get install -y git wget unzip
cd /root
git clone --depth 1 https://github.com/Wayne0318-Dev/MMAL.git
cd MMAL
cp .env.vps.example .env
nano .env
```

把 `IMPORT_KEY=` 后面改成你们自己的导入口令（可与 Vercel 上同一条）。`Ctrl+O` 回车保存，`Ctrl+X` 退出。然后：

```bash
docker compose up -d --build
```

`git clone` 若卡住或报错，不要反复刷新网页，改用：

```bash
cd /root
wget -O mmal.zip https://github.com/Wayne0318-Dev/MMAL/archive/refs/heads/main.zip
unzip -o mmal.zip
cd MMAL-main
cp .env.vps.example .env
nano .env
```

同样改 `IMPORT_KEY` 后：

```bash
docker compose up -d --build
```

构建第一次要几分钟。结束后执行：

```bash
docker compose ps
```

状态为 `running` 后，浏览器打开 `http://公网IP:43127`（例如 `http://129.204.51.76:43127`）。点 **导入新表**，应显示 **数据在服务器**。防火墙必须已放行 TCP **43127**。

Docker 拉基础镜像很慢时，可先写入腾讯云镜像再构建：

```bash
sudo mkdir -p /etc/docker
echo '{"registry-mirrors":["https://mirror.ccs.tencentyun.com"]}' | sudo tee /etc/docker/daemon.json
sudo systemctl restart docker
```

然后回到项目目录再执行 `docker compose up -d --build`。

更新程序：在同一目录再 `git pull`（或重新下载 zip 覆盖）后 `docker compose up -d --build`。表格在 Docker 卷 `mold-data` 里，重建不会清数据。

### 通用步骤（已有项目文件夹时）

```bash
cp .env.vps.example .env
```

编辑 `.env` 里的 `IMPORT_KEY`，然后：

```bash
docker compose up -d --build
```

---

## 方案 A：Vercel + Turso（免费，需 GitHub 能连一次）

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

### 2.2 新建数据库（对照 Create Database 弹窗）

上面两个页签保持 **New Database**（不要点 Upload SQLite File）。

| 栏 | 怎么填 |
| --- | --- |
| **Name** | `mold-machine`（只能小写、数字、短横线，不要空格） |
| **Location** | 点下拉，选离中国近的，优先 **Singapore** / **Tokyo** / **Hong Kong**。没有这些就选列表里带 Asia 的。 |
| 灰色开关 **Run this database on TursoDB…** | **保持关闭（靠左、灰色）**。不要打开。本项目要的是默认 libSQL，不是 TursoDB。 |

然后点右下角黑色按钮 **Create Database**。等列表里出现 `mold-machine`，状态变成 Ready / 可用。


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

- **GitHub / Vercel 网页打不开**：中国大陆常见情况。车间查询不要依赖 GitHub；改走本文开头的 **方案 B**。
- **Vercel 卡片写着 No Production Deployment**：GitHub 仓库是空的，或这个项目的代码还没推进去。Vercel 没有可构建的文件，网址不会出现查询页。必须先把本项目完整代码推到 Vercel 所连接的那个 GitHub 仓库，等 Deployments 出现一次绿色 Production。
- **浏览器 ERR_CONNECTION_RESET / 无法访问此页面**：从中国大陆打开 `*.vercel.app` 经常被重置，和 Turso 是否建好无关。即便部署成功，车间电脑也可能打不开。这种情况改走 **方案 B**。
- **Vercel 列表里没有仓库**：第 1 步没建 GitHub 仓库，或授权时没勾这个仓库。到 Vercel → Settings → Git 重新授权。
- **构建成功但导入报错 / 仍显示本机**：环境变量没填、填错名、或填完没 Redeploy。
- **导入口令不对**：网站上填的必须和 Vercel 里 `IMPORT_KEY` 完全一致。
- **Token 过期或权限只读**：回 Turso 重新生成读写、不过期的 Token，更新 Vercel 变量后再 Redeploy。
- **不要**用 Vercel Blob、网盘、静态网页托管来存 xlsx。本项目只认 Turso 那两项变量。
