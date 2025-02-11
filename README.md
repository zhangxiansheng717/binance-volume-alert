

好的，我来更新 README.md 文件，简化技术架构并更新实现细节。


# Binance Volume Surge Alert Bot

一个用于监控币安合约市场交易量暴涨的告警机器人。当币价上涨的同时，交易量在1分钟内暴涨超过100倍时，通过Telegram发送提醒。

## 功能特性

- 实时监控币安合约市场所有交易对
- 分析交易对的价格和成交量变化
- 当满足以下条件时发送Telegram告警：
  - 价格相比上一分钟上涨
  - 成交量超过上一分钟的100倍
- 支持部署到Vercel平台

## 技术架构

- 后端：Node.js
- 数据源：Binance Futures API
- 消息推送：Telegram Bot API
- 数据存储：内存存储 (Map)
- 部署平台：Vercel

## 项目结构
```
├── src/
│   ├── services/          
│   │   ├── binance.js     # 币安API服务
│   │   ├── telegram.js    # Telegram机器人服务
│   │   └── monitor.js     # 价格监控服务
│   └── index.js           # 入口文件
├── vercel.json            # Vercel配置
└── package.json
```

## 环境变量配置
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## 安装部署

1. 克隆仓库
```bash
git clone https://github.com/yourusername/binance-volume-surge-alert
cd binance-volume-surge-alert
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
- 创建Telegram机器人并获取token
- 设置环境变量

4. 运行程序
```bash
node src/index.js
```

## 实现原理

### 1. 数据获取
- 使用币安期货API `/fapi/v1/ticker/24hr` 获取所有交易对数据
- 每分钟获取一次最新数据

### 2. 数据处理
- 使用 JavaScript Map 对象存储上一分钟的价格和成交量数据
- 实时计算价格和成交量变化率

### 3. 告警触发
- 当检测到价格上涨且成交量超过阈值时
- 通过Telegram Bot发送告警消息

## 使用到的API

### Binance API
- REST API: https://fapi.binance.com/fapi/v1/ticker/24hr


### Telegram Bot API
- 发送消息接口：https://api.telegram.org/bot<token>/sendMessage
- 消息格式：
```json
{
    "chat_id": "YOUR_CHAT_ID",
    "text": "🚨 交易量暴涨提醒\n币种：BTC/USDT\n当前价格：30000\n价格变化：+2%\n成交量变化：120倍",
    "parse_mode": "HTML"
}
```

## 注意事项

### 1. 数据存储
- 使用内存存储，服务重启会重置数据
- 重启后需等待一分钟才能开始新的比较

### 2. API限制
- Binance API 有请求频率限制
- 建议实现请求频率控制和错误重试机制

### 3. 监控告警
- 服务健康检查
- 错误日志记录
- 告警阈值可配置

## 开发计划

### Phase 1: 基础功能
- [x] 项目初始化
- [x] Binance API 集成
- [x] Telegram Bot 集成
- [x] 内存数据存储

### Phase 2: 功能优化
- [ ] 错误重试机制
- [ ] 自定义告警阈值
- [ ] 日志记录功能

### Phase 3: 可选扩展
- [ ] 历史数据分析
- [ ] 更多技术指标
- [ ] Web控制面板

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进项目。

## 许可证

MIT License
