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
    }

    async sendAlert(symbol, price, priceChange, volumeChange, quoteVolume) {
        const message = `🚨 交易量暴涨提醒

币种：${symbol}
当前价格：${price} USDT
价格变化：+${priceChange}%
5分钟交易量变化：${volumeChange}倍
5分钟成交额：${quoteVolume} USDT

⏰ ${new Date().toLocaleString()}`;

        try {
            await this.bot.sendMessage(this.chatId, message);
            console.log(`已发送 Telegram 提醒: ${symbol}`);
        } catch (error) {
            console.error('发送 Telegram 消息失败:', error.message);
            console.error('完整错误:', error);
            console.error('消息内容:', message);
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