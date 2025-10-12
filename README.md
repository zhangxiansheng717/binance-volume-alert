# 币安合约交易量监控机器人

一个用于监控币安合约市场交易量和价格变化的本地机器人，当发现交易量暴涨且价格上涨时，通过 Telegram 发送提醒。

# 获取 Telegram 配置及完整部署流程

## 如何获取 Telegram 配置

### 步骤1：创建 Telegram Bot 并获取 Token

1. 打开 Telegram，搜索 **@BotFather**
2. 发送命令 `/newbot`
3. 按提示操作：

 * 给你的机器人起个名字：`Binance Monitor Bot`
 * 给机器人设置用户名（必须以`bot`结尾）：`binance_alert_bot`

4. 创建成功后，BotFather 会给你一个 Token，类似：
   `1234567888:ABCdefGHIjklMNOpqrsTUVwxyz`
    这就是你的 **`TELEGRAM_BOT_TOKEN`** ✅

### 步骤2：获取你的 Chat ID

1. 在 Telegram 搜索 **@userinfobot**
2. 点击 **START** 或发送任意消息
3. 机器人会回复你的信息，找到 `Id:` 后面的数字，例如：
   `Id: 123456789`
    这就是你的 **`TELEGRAM_CHAT_ID`** ✅

### 步骤3：让你的 Bot 能给你发消息

1. 在 Telegram 搜索你刚才创建的机器人（例如 `@binance_alert_bot`）
2. 点击 **START** 按钮
3. 现在机器人就可以给你发消息了！

---

### Telegram 配置示例:

```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUuwxyz
TELEGRAM_CHAT_ID=123456789
USE_PROXY=false
```

### 使用场景

**场景1：个人使用（最常见）** ⭐

```env
TELEGRAM_BOT_TOKEN=1234567890:ABC...
TELEGRAM_CHAT_ID=123456789  # ← 你的个人Chat ID
```

**场景2：发送到群组**

```env
TELEGRAM_BOT_TOKEN=1234567890:ABC...
TELEGRAM_CHAT_ID=-1001234567890  # ← 群组的Chat ID（负数）```
**步骤：**
1. 创建一个 Telegram 群组。
2. 把机器人拉进群组。
3. 获取群组的 Chat ID（负数，如 `-1001234567890`）。
4. 配置到 `.env` 文件。

**如何获取群组Chat ID：**
使用 **@username_to_id_bot**
1. 把这个机器人拉进你的群组。
2. 它会自动发送群组的 ID。

---

## 完整部署流程（适合海外服务器）

### 1. 准备环境

*   **更新系统**
    ```bash
    sudo apt update && sudo apt upgrade -y (基本用不到，直接跳过)
```

* **安装 Node.js 18.x**

  ```bash
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt install -y nodejs
  ```

* **安装 git 和 PM2**

  ```bash
  sudo apt install git -y
  sudo npm install pm2 -g
  ```

* **验证安装**

  ```bash
  node -v    # 应该显示 v18.x.x
  npm -v     # 应该显示 9.x.x 或更高
  pm2 -v     # 应该显示版本号
  ```

### 2. 克隆并配置项目

* **创建项目目录**

  ```bash
  mkdir -p /home/ubuntu/projects
  cd /home/ubuntu/projects
  ```

* **克隆项目（使用你的实际Git地址）**

  ```bash
  git clone https://github.com/yourusername/binance-volume-alert.git
  cd binance-volume-alert
  ```

* **安装依赖**

  ```bash
  npm install
  ```

* **复制配置文件**

  ```bash
  cp .env.example .env
  ```

* **编辑配置文件**

  ```bash
  nano .env
  ```

### 3. 测试配置

* **测试 Telegram 配置是否正确**

  ```bash
  node test-telegram.js
  ```

  如果配置正确，你会：

  *   控制台显示：`测试成功！`
  *   Telegram 收到测试消息 ✅

  如果出错，检查：

  *   Token 是否正确（没有多余空格）
  *   Chat ID 是否正确
  *   是否点击了机器人的 **START** 按钮

### 4. 启动服务

* **启动监控服务**

  ```bash
  pm2 start src/index.js --name "binance-monitor"
  ```

* **查看日志（确认正常运行）**

  ```bash
  pm2 logs binance-monitor
  ```

  如果正常，你会看到类似输出：

  ```
  ⏰ 开始新一轮15分钟周期市场检查...
  📊 15分钟周期获取到 280 个交易对，有效数据 275 个
  ```

### 5. 设置开机自启

* **保存当前PM2进程列表**

  ```bash
  pm2 save
  ```

* **生成开机自启动脚本**

  ```bash
  pm2 startup
  ```

* **复制并执行输出的命令（类似下面这样）**

  ```bash
  sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
  ```

### 6. 常用管理命令

* **查看运行状态**

  ```bash
  pm2 status
  ```

* **查看实时日志**

  ```bash
  pm2 logs binance-monitor
  ```

* **查看最近100行日志**

  ```bash
  pm2 logs binance-monitor --lines 100
  ```

* **停止服务**

  ```bash
  pm2 stop binance-monitor
  ```

* **重启服务**

  ```bash
  pm2 restart binance-monitor
  ```

* **删除服务**

  ```bash
  pm2 delete binance-monitor
  ```

* **查看详细信息**

  ```bash
  pm2 show binance-monitor
  ```

---

## 手动更新流程

如果以后需要更新代码，请按以下步骤操作：

```bash
# 1. 进入项目目录
cd /home/ubuntu/projects/binance-volume-alert

# 2. 拉取最新代码
git pull origin master

# 3. 安装可能新增的依赖
npm install

# 4. 重启服务以应用更新
pm2 restart binance-monitor
```
## 功能特点

- 实时监控币安合约市场所有 USDT 交易对
- **多时间周期监控**：支持 5分钟、15分钟、1小时、4小时、1日 等多个时间周期
- 智能调度：不同时间周期在不同时间点检查，避免API限制
- 当符合以下条件时发送 Telegram 提醒：
  - 当前周期交易量比历史平均交易量增加指定倍数以上
  - 价格比上一次检查时上涨指定百分比以上
  - 成交额超过指定 USDT 金额
- 显示详细的成交额、价格变化信息，区分不同时间周期
- 支持通过代理访问币安 API 和 Telegram
- 灵活配置：可通过环境变量开启/关闭特定时间周期
- 向后兼容：支持原有的单一时间周期模式

## 监控逻辑说明

### 多时间周期监控

1. **支持的时间周期**
   - **5分钟**：每5分钟周期第3秒检查，基准期30分钟（6个周期）
   - **15分钟**：每15分钟周期第10秒检查，基准期90分钟（6个周期）
   - **1小时**：每小时第30秒检查，基准期6小时（6个周期）
   - **4小时**：每4小时第2分钟检查，基准期24小时（6个周期）
   - **1日**：每日第5分钟检查，基准期6天（6个周期）

2. **交易量计算逻辑**
   - 使用对应时间周期K线的币种交易量（而不是USDT成交额）
   - 当前交易量：最新已完成的K线的币种交易量（完整数据）
   - 基准交易量：前6根同周期K线的平均币种交易量
   - 成交额（USDT）仅用于最小交易额筛选

3. **预警条件（每个时间周期独立配置）**
   - 交易量倍数 = 最新完整周期币种交易量 ÷ 历史平均币种交易量
   - 当交易量倍数超过设定阈值（各周期可独立配置）
   - 且价格上涨超过最小涨幅（所有周期共用，默认0.1%）
   - 且成交额超过最小限制（各周期可独立配置）

4. **默认配置**
   - 5分钟：交易量阈值2倍，最小成交额10万USDT
   - 15分钟：交易量阈值2.5倍，最小成交额30万USDT
   - 1小时：交易量阈值3倍，最小成交额100万USDT
   - 4小时：交易量阈值4倍，最小成交额500万USDT
   - 1日：交易量阈值5倍，最小成交额1000万USDT

5. **显示信息**
   - 每个时间周期独立显示最近3个交易对的详细数据
   - 包含时间周期标识、交易量变化倍数、价格信息等

6. **Telegram 提醒格式**
```
🚨 交易量暴涨提醒

币种：BTCUSDT (1小时)
当前价格：48000 USDT
价格变化：+1.5%
1小时交易量变化：3.2倍
1小时成交额：1500000 USDT

⏰ 2024-02-12 15:30:00
```

## 快速开始

### 本地运行
1. 确保你的环境满足以下要求：
   - Node.js 18.x 或以上版本
   - npm（通常随 Node.js 一起安装）
   - 如果在中国大陆使用，需要准备代理

2. 克隆项目并安装依赖：
```bash
git clone [项目地址]
cd binance-volume-alert
npm install
```

3. 配置环境变量：
```bash
# 复制环境变量示例文件
cp .env.example .env

# 编辑 .env 文件，填入必要的配置
# Windows: notepad .env
# Mac/Linux: nano .env 或 vim .env
```

4. 配置说明：
```env
# Telegram配置（必需）
TELEGRAM_BOT_TOKEN=你的机器人Token
TELEGRAM_CHAT_ID=你的聊天ID

# 如果在中国大陆使用，需要配置代理
USE_PROXY=true
PROXY_HOST=127.0.0.1
PROXY_PORT=10809

# ========== 多时间周期监控配置 ==========
# 是否启用多时间周期监控（默认启用）
ENABLE_MULTI_TIMEFRAME=true

# 各时间周期的开关（默认全部启用）
ENABLE_15M=true
ENABLE_1H=true
ENABLE_4H=true
ENABLE_1D=true

# ========== 各时间周期独立配置 ==========
# 5分钟周期
VOLUME_THRESHOLD_5M=2
MIN_QUOTE_VOLUME_5M=100000

# 15分钟周期
VOLUME_THRESHOLD_15M=2.5
MIN_QUOTE_VOLUME_15M=300000

# 1小时周期
VOLUME_THRESHOLD_1H=3
MIN_QUOTE_VOLUME_1H=1000000

# 4小时周期
VOLUME_THRESHOLD_4H=4
MIN_QUOTE_VOLUME_4H=5000000

# 1日周期
VOLUME_THRESHOLD_1D=5
MIN_QUOTE_VOLUME_1D=10000000

# ========== 通用配置 ==========
MIN_PRICE_CHANGE=0.1     # 最小价格变化百分比（所有周期共用）

# ========== 向后兼容配置（单一时间周期模式） ==========
# 当 ENABLE_MULTI_TIMEFRAME=false 时使用
VOLUME_THRESHOLD=2
MIN_QUOTE_VOLUME=100000
CHECK_INTERVAL=60000
```

> **注意**: 程序使用固定的5分钟检查周期，这是为了配合币安5分钟K线数据的更新周期。每次检查都会自动对齐到下一个5分钟周期的第3秒，以确保获取到完整的K线数据。

5. 测试配置：
```bash
# 测试 Telegram 配置是否正确
node test-telegram.js
```

6. 运行方式：

方式一：直接运行（适合测试）
```bash
# 使用 node 直接运行
node src/index.js

# 或使用 npm script
npm start
```

方式二：后台运行（推荐生产环境使用）
```bash
# 全局安装 PM2
npm install pm2 -g

# 使用 PM2 启动服务
pm2 start src/index.js --name "binance-monitor"

# 查看运行状态
pm2 status

# 查看日志
pm2 logs binance-monitor

# 停止服务
pm2 stop binance-monitor

# 重启服务
pm2 restart binance-monitor
```

7. 常见问题：
- 如果提示 "Error: connect ETIMEDOUT"，检查代理配置
- 如果 Telegram 测试失败，检查 Token 和 Chat ID 是否正确
- 如果需要查看详细日志，可以查看 `logs` 目录下的日志文件

## 安装部署

### 本地开发环境
1. 克隆项目并安装依赖：
```bash
git clone [项目地址]
cd binance-volume-alert
npm install
```

2. 配置环境变量：
   复制 `.env.example` 文件并重命名为 `.env`：
```bash
cp .env.example .env
```
   然后编辑 `.env` 文件，填入你的配置。

### 服务器部署
1. 准备环境：
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 git 和 PM2
sudo apt install git
sudo npm install pm2 -g
```

2. 部署项目：
```bash
# 克隆项目
cd /home/ubuntu/projects
git clone [项目地址]
cd binance-volume-alert

# 安装依赖
npm install

# 配置环境
cp .env.example .env
nano .env

# 启动服务
pm2 start src/index.js --name "binance-monitor"
pm2 start src/update.js --name "auto-updater"

# 设置开机自启
pm2 startup
pm2 save
```

### CentOS 系统部署
1. 准备环境：
```bash
# 更新系统
sudo yum update -y

# 安装 EPEL 源
sudo yum install epel-release -y

# 安装 Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 安装开发工具（用于编译某些 npm 包）
sudo yum groupinstall "Development Tools" -y

# 安装 git
sudo yum install git -y

# 全局安装 PM2
sudo npm install pm2 -g
```

2. 创建项目目录：
```bash
# 创建项目目录
sudo mkdir -p /opt/projects
sudo chown -R $USER:$USER /opt/projects
cd /opt/projects
```

3. 部署项目：
```bash
# 克隆项目
git clone [项目地址]
cd binance-volume-alert

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
vim .env  # 或使用 nano .env

# 测试配置
node test-telegram.js

# 使用 PM2 启动服务
pm2 start src/index.js --name "binance-monitor"
pm2 start src/update.js --name "auto-updater"

# 设置开机自启
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
pm2 save
```

4. 防火墙配置（如果需要）：
```bash
# 如果使用 firewalld
sudo firewall-cmd --permanent --add-port=80/tcp  # 如果需要对外暴露服务
sudo firewall-cmd --reload

# 如果使用 iptables
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo service iptables save
```

5. SELinux 设置（如果启用了 SELinux）：
```bash
# 查看 SELinux 状态
getenforce

# 如果需要，可以临时关闭 SELinux
sudo setenforce 0

# 或永久关闭（需要重启）
sudo sed -i 's/SELINUX=enforcing/SELINUX=disabled/' /etc/selinux/config
```

6. 日志查看：
```bash
# 查看应用日志
pm2 logs binance-monitor

# 查看更新服务日志
pm2 logs auto-updater

# 查看系统日志
sudo journalctl -u pm2-$USER
```

7. 常见问题处理：
- 如果遇到权限问题：
```bash
# 确保项目目录权限正确
sudo chown -R $USER:$USER /opt/projects/binance-volume-alert

# 确保 .env 文件权限正确
chmod 600 .env
```

- 如果 Node.js 版本过低：
```bash
# 删除旧版本
sudo yum remove nodejs

# 重新安装新版本
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### CentOS 环境变量修改与重启
1. 修改环境变量：
```bash
# 编辑 .env 文件
vim /opt/projects/binance-volume-alert/.env

# 确保文件权限正确
chmod 600 .env
```

2. 重启服务：
```bash
# 方式一：使用 pm2 重启
pm2 restart binance-monitor
pm2 restart auto-updater

# 方式二：停止后重新启动
pm2 stop binance-monitor auto-updater
pm2 start binance-monitor auto-updater

# 查看是否重启成功
pm2 status

# 查看日志确认是否正常运行
pm2 logs binance-monitor
```

3. 如果重启后仍有问题：
```bash
# 删除 pm2 进程并重新启动
pm2 delete binance-monitor auto-updater
cd /opt/projects/binance-volume-alert
pm2 start src/index.js --name "binance-monitor"
pm2 start src/update.js --name "auto-updater"

# 保存新的进程列表
pm2 save
```

## 自动更新
项目包含自动更新功能：
- 每小时自动检查 GitHub 仓库更新
- 如有更新自动拉取并重启服务
- 可通过 `pm2 logs auto-updater` 查看更新日志

## 常用命令
```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs binance-monitor
pm2 logs auto-updater

# 重启服务
pm2 restart binance-monitor

# 停止服务
pm2 stop binance-monitor
```

## 注意事项

1. 确保服务器能访问 GitHub（用于自动更新）
2. 如果使用代理，确保代理配置正确
3. 确保 Telegram 机器人已正确配置并有发送消息权限
4. 首次部署建议先运行测试：`node test-telegram.js`

## 更新日志

### v1.0.0 (2024-03-21)
- 初始版本发布
- 实现基本的交易量和价格监控功能
- 添加 Telegram 提醒功能
- 支持代理配置
- 添加自动更新功能

### v1.0.1 (2024-03-21)
- 优化内存使用
  - 减少历史数据存储大小
  - 优化数据结构，只保存必要信息
  - 增加基于时间的数据清理机制
- 改进日志输出，减少冗余信息

## 输出信息说明

程序会在控制台显示以下信息：
- 监控的交易对数量
- 符合条件的交易对详细信息：
  - 交易对名称
  - 时间对比
  - 成交量对比
  - 成交额对比（USDT）
  - 价格对比和涨幅

## 注意事项

1. 确保本地网络能够访问币安 API
2. 如果使用代理，确保代理配置正确
3. 确保 Telegram 机器人已正确配置并有发送消息权限
4. 程序需要持续运行才能实时监控市场

## 常见问题

1. 如果无法连接币安 API：
   - 检查网络连接
   - 确认代理配置是否正确
   - 查看错误日志

2. 如果没有收到 Telegram 提醒：
   - 确认机器人 token 是否正确
   - 确认 chat ID 是否正确
   - 使用 test.js 测试机器人连接

## 服务器更新说明

### CentOS 更新步骤
1. 进入项目目录：
```bash
cd /opt/projects/binance-volume-alert  # 或你的项目目录
```

2. 拉取最新代码：
```bash
git pull origin master
```

3. 如果有新的依赖，安装它们：
```bash
npm install
```

4. 重启服务：
```bash
pm2 restart binance-monitor
```

5. 查看运行状态：
```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs binance-monitor
```

### 常见问题处理
1. 如果拉取代码时有冲突：
```bash
# 放弃本地修改
git reset --hard HEAD
git pull origin master
```

2. 如果需要回滚到之前版本：
```bash
# 查看提交历史
git log --oneline -5

# 回滚到指定版本
git reset --hard <commit_id>
pm2 restart binance-monitor
```

3. 如果服务启动失败：
```bash
# 查看详细错误日志
pm2 logs binance-monitor --lines 100
```

