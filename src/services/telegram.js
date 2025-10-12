const TelegramBot = require('node-telegram-bot-api');
const config = require('../config/config');
const { HttpsProxyAgent } = require('https-proxy-agent');

class TelegramService {
    constructor() {
        const options = { polling: false };
        
        // 如果启用了代理，添加代理配置
        if (config.proxy.use) {
            const proxyUrl = `http://${config.proxy.host}:${config.proxy.port}`;
            options.request = {
                agent: new HttpsProxyAgent(proxyUrl)
            };
            console.log('Telegram 使用代理:', proxyUrl);
        }

        this.bot = new TelegramBot(config.telegram.botToken, options);
        this.chatId = config.telegram.chatId;
        
        // 每日提醒次数统计（按 symbol+interval+direction 分组）
        this.dailyAlertCount = new Map(); // key: "symbol_interval_direction", value: count
        this.lastResetDate = new Date().toDateString();
        
        // 冷却机制：记录最后提醒时间
        this.cooldownMap = new Map(); // key: "symbol_interval_direction", value: lastAlertTime
        
        // 启动每日重置定时器
        this.startDailyReset();
    }

    // 每日重置提醒次数
    resetDailyCount() {
        const today = new Date().toDateString();
        if (today !== this.lastResetDate) {
            console.log(`\n🔄 重置每日提醒次数统计 (${today})`);
            this.dailyAlertCount.clear();
            this.lastResetDate = today;
        }
    }

    // 启动每日重置定时器（每小时检查一次）
    startDailyReset() {
        setInterval(() => {
            this.resetDailyCount();
        }, 60 * 60 * 1000); // 每小时检查
    }

    // 检查是否在冷却期
    isInCooldown(symbol, interval, direction, cooldownMinutes) {
        const key = `${symbol}_${interval}_${direction}`;
        const lastAlertTime = this.cooldownMap.get(key);
        
        if (!lastAlertTime) return false;
        
        const now = Date.now();
        const cooldownMs = cooldownMinutes * 60 * 1000;
        return (now - lastAlertTime) < cooldownMs;
    }
    
    // 记录提醒时间（更新冷却）
    recordAlertTime(symbol, interval, direction) {
        const key = `${symbol}_${interval}_${direction}`;
        this.cooldownMap.set(key, Date.now());
    }
    
    // 获取并增加提醒次数
    getAndIncrementAlertCount(symbol, interval, direction) {
        this.resetDailyCount(); // 每次调用时检查是否需要重置
        
        const key = `${symbol}_${interval}_${direction}`;
        const count = this.dailyAlertCount.get(key) || 0;
        const newCount = count + 1;
        this.dailyAlertCount.set(key, newCount);
        return newCount;
    }
    
    // 计算强度等级
    calculateIntensity(priceChange, threshold, volumeMultiplier) {
        const x = Math.abs(priceChange) / threshold;
        const volumeQualified = volumeMultiplier >= 2.0;
        
        // x < 2：无强度
        if (x < 2) {
            return { level: 'none', tag: '', x: x.toFixed(1), show: false };
        }
        
        // x >= 3 且量能达标：💥爆
        if (x >= 3 && volumeQualified) {
            return { level: 'explosive', tag: '💥爆', x: x.toFixed(1), show: true };
        }
        
        // 2 <= x < 3 且量能达标：⚡强
        if (x >= 2 && x < 3 && volumeQualified) {
            return { level: 'strong', tag: '⚡强', x: x.toFixed(1), show: true };
        }
        
        // 其他情况：仅超阈（不显示强度行）
        return { level: 'threshold', tag: '', x: x.toFixed(1), show: false };
    }

    async sendAlert(alertData) {
        const { symbol, price, priceChange, interval, threshold, volumeMultiplier, cooldownMinutes,
                rsi, ema7, ema25, atr, trend, resistance } = alertData;
        
        // 判断涨跌方向
        const direction = priceChange >= 0 ? '上涨' : '下跌';
        const directionKey = priceChange >= 0 ? 'up' : 'down';
        const changeSymbol = priceChange >= 0 ? '+' : '';
        
        // 检查冷却
        if (this.isInCooldown(symbol, interval, directionKey, cooldownMinutes)) {
            console.log(`⏸️  ${symbol} (${interval}) ${direction} 在冷却期内，跳过提醒`);
            return false;
        }
        
        // 计算强度
        const intensity = this.calculateIntensity(priceChange, threshold, volumeMultiplier);
        
        // 获取提醒次数
        const alertCount = this.getAndIncrementAlertCount(symbol, interval, directionKey);
        
        // 记录提醒时间（启动冷却）
        this.recordAlertTime(symbol, interval, directionKey);
        
        // 格式化时间
        const now = new Date();
        const timeStr = now.toLocaleString('zh-CN', { 
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false 
        }).replace(/\//g, '-');
        
        // 格式化价格
        const formattedPrice = parseFloat(price).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 8
        });
        
        // 周期颜色标识
        const intervalEmoji = {
            '5m': '🔴',
            '15m': '🟡',
            '1h': '🟢',
            '4h': '🔵',
            '1d': '⚪'
        };
        const intervalDisplay = `${intervalEmoji[interval] || '⚫'} ${interval}`;
        
        // RSI状态
        const rsiStatus = rsi >= 70 ? '⚠️ 超买' : 
                         rsi <= 30 ? '💡 超卖' : 
                         rsi >= 50 ? '✅ 强势' : '📊 弱势';
        
        // 趋势显示
        const trendEmoji = trend === 'up' ? '🚀' : '📉';
        const trendText = trend === 'up' ? '多头排列' : '空头排列';
        
        // 量能等级
        const volumeTag = volumeMultiplier >= 3 ? '💥 爆量' :
                         volumeMultiplier >= 2 ? '⚡ 放量' :
                         volumeMultiplier >= 1 ? '📊 正常' : '⚠️ 缩量';
        
        // 支撑位（EMA25）
        const support = ema25;
        
        // 综合评级
        let rating = 'B';
        let ratingEmoji = '⚠️';
        let suggestion = '观望';
        
        if (priceChange > 0) {  // 上涨
            if (rsi < 70 && volumeMultiplier >= 2 && trend === 'up') {
                rating = 'A';
                ratingEmoji = '✅';
                suggestion = '做多';
            } else if (rsi >= 80) {
                rating = 'C';
                ratingEmoji = '⚠️';
                suggestion = '谨慎追高';
            }
        } else {  // 下跌
            if (rsi <= 30 && volumeMultiplier >= 2) {
                rating = 'B';
                ratingEmoji = '💡';
                suggestion = '关注反弹';
            }
        }
        
        // 构建消息
        const countText = ` 第${alertCount}次提醒`;
        let message = `📊 合约价格异动提醒（${symbol}${countText}）\n\n`;
        message += `交易对: ${symbol}\n`;
        message += `周期: ${intervalDisplay}\n`;
        message += `变动幅度: ${changeSymbol}${Math.abs(priceChange).toFixed(2)}% (${direction})\n`;
        message += `阈值: ${threshold}%\n`;
        message += `当前价格: ${formattedPrice}\n\n`;
        
        // 技术分析
        message += `📈 技术分析:\n`;
        message += `• RSI(14): ${rsi.toFixed(0)} ${rsiStatus}\n`;
        message += `• MA趋势: ${trendEmoji} ${trendText}\n`;
        message += `• EMA7: ${ema7.toFixed(2)} | EMA25: ${ema25.toFixed(2)}\n`;
        message += `• 量能: ${volumeTag} ${volumeMultiplier.toFixed(1)}x\n`;
        message += `• ATR: ${atr.toFixed(2)} (参考止损距离)\n\n`;
        
        // 参考位置
        message += `💰 参考位置:\n`;
        message += `• 支撑位: $${support.toFixed(2)} (EMA25)\n`;
        message += `• 阻力位: $${resistance.toFixed(2)} (前高)\n\n`;
        
        // 综合评级
        message += `💡 综合评级: ${rating}级信号\n`;
        message += `${ratingEmoji} 建议方向: ${suggestion}\n\n`;
        
        message += `时间: ${timeStr}`;

        try {
            await this.bot.sendMessage(this.chatId, message, {
                disable_notification: intensity.level === 'threshold'
            });
            
            const intensityDesc = intensity.show ? `${intensity.tag} x${intensity.x}` : '仅超阈';
            console.log(`✅ 已发送提醒: ${symbol} (${interval}) ${direction} ${intensityDesc} (今日第${alertCount}次)`);
            return true;
        } catch (error) {
            console.error('发送 Telegram 消息失败:', error.message);
            console.error('完整错误:', error);
            return false;
        }
    }

    async testMessage() {
        const message = `🤖 测试消息\n` +
            `时间：${new Date().toLocaleString()}\n` +
            `如果你收到这条消息，说明 Telegram 机器人配置正确！`;

        try {
            const result = await this.bot.sendMessage(this.chatId, message);
            console.log('测试消息发送成功！');
            return true;
        } catch (error) {
            // 如果错误是 EFATAL 和 socket hang up，但消息可能已发送
            if (error.message.includes('socket hang up')) {
                console.log('警告: 连接中断，但消息可能已发送成功');
                return true;
            }
            console.error('发送测试消息失败:', error.message);
            return false;
        }
    }
}

module.exports = new TelegramService();
