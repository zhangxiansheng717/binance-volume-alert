好的，我来创建一个详细的 README.md 文件：

```markdown:README.md
# 币安合约交易量监控机器人

一个用于监控币安合约市场交易量和价格变化的本地机器人，当发现交易量暴涨且价格上涨时，通过 Telegram 发送提醒。

## 功能特点

- 实时监控币安合约市场所有 USDT 交易对
- 每分钟检查一次交易量和价格变化
- 当符合以下条件时发送 Telegram 提醒：
  - 成交量比上一分钟增加 2 倍以上
  - 价格比上一分钟上涨 0.1% 以上
- 显示详细的成交量、成交额和价格变化信息
- 支持通过代理访问币安 API

## 安装步骤

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
   然后编辑 `.env` 文件，填入你的配置：
```env
# Telegram配置
TELEGRAM_BOT_TOKEN=你的机器人token
TELEGRAM_CHAT_ID=你的聊天ID

# 币安API配置（如果需要）
BINANCE_API_KEY=你的API密钥
BINANCE_API_SECRET=你的API密钥

# 代理配置
PROXY_HOST=127.0.0.1
PROXY_PORT=10809
USE_PROXY=true  # 设置为false可以禁用代理

# 监控参数
VOLUME_THRESHOLD=2        # 成交量增加倍数阈值
MIN_PRICE_CHANGE=0.1     # 最小价格上涨百分比
MIN_QUOTE_VOLUME=100000  # 最低成交额(USDT)
CHECK_INTERVAL=60000     # 检查间隔(毫秒)
```

3. 配置代理（如果需要）：
   在 `src/services/binance.js` 中修改代理配置：
```javascript
const proxyConfig = {
    host: '127.0.0.1',
    port: '10809'  // 根据你的代理软件配置修改
};
```

## 使用方法

1. 启动程序：
```bash
node src/index.js
```

2. 测试 Telegram 机器人：
```bash
node test.js
```

## 监控参数设置

可以在 `src/services/monitor.js` 中调整以下参数：

```javascript
this.VOLUME_THRESHOLD = 2;        // 成交量增加倍数阈值
this.MIN_PRICE_CHANGE = 0.1;      // 最小价格上涨百分比
```

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
   - `VOLUME_THRESHOLD`: 成交量增加倍数阈值（默认：2）
   - `MIN_PRICE_CHANGE`: 最小价格上涨百分比（默认：0.1）
   - `MIN_QUOTE_VOLUME`: 最低成交额USDT（默认：100000）
   - `CHECK_INTERVAL`: 检查间隔毫秒（默认：60000）

3. 币安API配置（可选）
   - 本项目仅使用币安的公共API，不需要配置API密钥
   - 如果将来需要访问私有API，再配置以下参数：
     - `BINANCE_API_KEY`: 币安API密钥
     - `BINANCE_API_SECRET`: 币安API密钥
```

这个 README.md 文件包含了：
1. 项目介绍和功能说明
2. 安装和配置步骤
3. 使用方法和参数设置
4. 输出信息说明
5. 注意事项和常见问题
6. 更新日志
7. 配置说明

