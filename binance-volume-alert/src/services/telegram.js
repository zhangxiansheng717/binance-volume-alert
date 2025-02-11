const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

class TelegramService {
    constructor() {
        this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
        this.chatId = process.env.TELEGRAM_CHAT_ID;
    }

    async testMessage() {
        const message = `🤖 测试消息\n` +
            `时间：${new Date().toLocaleString()}\n` +
            `如果你收到这条消息，说明 Telegram 机器人配置正确！`;

        try {
            await this.bot.sendMessage(this.chatId, message);
            console.log('测试消息发送成功！');
        } catch (error) {
            console.error('发送测试消息失败:', error.message);
        }
    }

    async sendAlert(symbol, price, priceChange, volumeChange, quoteVolume) {
        const message = `🚨 交易量暴涨提醒\n` +
            `币种：${symbol}\n` +
            `当前价格：${price}\n` +
            `价格变化：${priceChange}%\n` +
            `成交量变化：${volumeChange}倍\n` +
            `成交额：${quoteVolume} USDT`;

        try {
            await this.bot.sendMessage(this.chatId, message);
        } catch (error) {
            console.error('Error sending Telegram message:', error.message);
        }
    }
}

module.exports = new TelegramService();