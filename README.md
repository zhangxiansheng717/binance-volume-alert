# 币安合约交易量监控机器人

一个用于监控币安合约市场交易量和价格变化的本地机器人，当发现交易量暴涨且价格上涨时，通过 Telegram 发送提醒。

## 功能特点

- 实时监控币安合约市场所有 USDT 交易对
- 每分钟检查一次交易量和价格变化
- 当符合以下条件时发送 Telegram 提醒：
  - 当前5分钟成交额（USDT）比前30分钟平均成交额增加指定倍数以上
  - 价格比上一次检查时上涨指定百分比以上
  - 5分钟成交额超过指定 USDT 金额
- 显示详细的成交额、价格变化信息
- 支持通过代理访问币安 API 和 Telegram
- 支持自动更新

## 监控逻辑说明

1. 交易量计算
   - 使用5分钟K线的币种交易量（而不是USDT成交额）
   - 当前交易量：最新一根5分钟K线的币种交易量（K线数据中的第6个值）
   - 基准交易量：前6根5分钟K线（30分钟）的平均币种交易量
   - 成交额（USDT）仅用于最小交易额筛选

2. 预警条件
   - 交易量倍数 = 当前5分钟币种交易量 ÷ 前30分钟平均币种交易量
   - 当交易量倍数超过设定阈值（默认20倍）
   - 且价格上涨超过最小涨幅（默认0.1%）
   - 且5分钟成交额超过最小限制（默认10万USDT）

3. 显示信息
   - 每次检查都会显示最近3个交易对的详细数据：
     * 当前5分钟交易量（币种数量）
     * 前30分钟平均交易量（币种数量）
     * 交易量变化倍数
     * 当前价格
     * 5分钟成交额（USDT）

4. Telegram 提醒格式
```
🚨 交易量暴涨提醒

币种：BTCUSDT
当前价格：48000 USDT
价格变化：+1.5%
5分钟交易量变化：25倍
5分钟成交额：150000 USDT

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

# 可选：监控参数（有默认值）
VOLUME_THRESHOLD=2        # 成交量增加倍数阈值
MIN_PRICE_CHANGE=0.1     # 最小价格变化百分比
MIN_QUOTE_VOLUME=100000  # 最低成交额（USDT）
CHECK_INTERVAL=60000     # 检查间隔（毫秒）
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

