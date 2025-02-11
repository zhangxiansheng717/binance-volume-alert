# 币安合约交易量监控机器人

一个用于监控币安合约市场交易量和价格变化的本地机器人，当发现交易量暴涨且价格上涨时，通过 Telegram 发送提醒。

## 功能特点

- 实时监控币安合约市场所有 USDT 交易对
- 每分钟检查一次交易量和价格变化
- 当符合以下条件时发送 Telegram 提醒：
  - 成交量比上一分钟增加 20 倍以上
  - 价格比上一分钟上涨 0.1% 以上
  - 成交额超过 10 万 USDT
- 显示详细的成交量、成交额和价格变化信息
- 支持通过代理访问币安 API 和 Telegram
- 支持自动更新

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

## 配置说明

### 必需配置
1. Telegram配置
   - `TELEGRAM_BOT_TOKEN`: Telegram机器人的访问令牌
   - `TELEGRAM_CHAT_ID`: 接收消息的聊天ID

### 可选配置
1. 代理配置（如果你在无法直接访问币安的地区）
   - `USE_PROXY`: 是否使用代理（true/false）
   - `PROXY_HOST`: 代理服务器地址
   - `PROXY_PORT`: 代理服务器端口

2. 监控参数（都有默认值）
   - `VOLUME_THRESHOLD`: 成交量增加倍数阈值（默认：20）
   - `MIN_PRICE_CHANGE`: 最小价格上涨百分比（默认：0.1）
   - `MIN_QUOTE_VOLUME`: 最低成交额USDT（默认：100000）
   - `CHECK_INTERVAL`: 检查间隔毫秒（默认：60000）

3. 币安API配置（可选）
   - 本项目仅使用币安的公共API，不需要配置API密钥
   - 如果将来需要访问私有API，再配置以下参数：
     - `BINANCE_API_KEY`: 币安API密钥
     - `BINANCE_API_SECRET`: 币安API密钥

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

## 输出信息说明

程序会在控制台显示以下信息：
- 监控的交易对数量
- 符合条件的交易对详细信息：
  - 交易对名称
  - 时间对比
  - 成交量对比
  - 成交额对比（USDT）
  - 价格对比和涨幅

## Telegram 提醒格式

当检测到符合条件的交易对时，会发送如下格式的提醒：
```
🚨 交易量暴涨提醒

币种：BTCUSDT
当前价格：45000.00
价格变化：+0.5%
成交量增加：2.5倍
```

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

## 更新日志

### v1.0.0 (2024-03-21)
- 初始版本发布
- 实现基本的交易量和价格监控功能
- 添加 Telegram 提醒功能
- 支持代理配置
- 添加自动更新功能

## 配置说明

### 必需配置
1. Telegram配置
   - `TELEGRAM_BOT_TOKEN`: Telegram机器人的访问令牌
   - `TELEGRAM_CHAT_ID`: 接收消息的聊天ID

### 可选配置
1. 代理配置（如果你在无法直接访问币安的地区）
   - `USE_PROXY`: 是否使用代理（true/false）
   - `PROXY_HOST`: 代理服务器地址
   - `PROXY_PORT`: 代理服务器端口

2. 监控参数（都有默认值）
   - `VOLUME_THRESHOLD`: 成交量增加倍数阈值（默认：20）
   - `MIN_PRICE_CHANGE`: 最小价格上涨百分比（默认：0.1）
   - `MIN_QUOTE_VOLUME`: 最低成交额USDT（默认：100000）
   - `CHECK_INTERVAL`: 检查间隔毫秒（默认：60000）

3. 币安API配置（可选）
   - 本项目仅使用币安的公共API，不需要配置API密钥
   - 如果将来需要访问私有API，再配置以下参数：
     - `BINANCE_API_KEY`: 币安API密钥
     - `BINANCE_API_SECRET`: 币安API密钥

