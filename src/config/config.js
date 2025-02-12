require('dotenv').config();

const config = {
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID
    },
    binance: {
        apiKey: process.env.BINANCE_API_KEY || null,
        apiSecret: process.env.BINANCE_API_SECRET || null,
        baseUrl: 'https://fapi.binance.com/fapi/v1'
    },
    proxy: {
        use: process.env.USE_PROXY === 'true',
        host: process.env.PROXY_HOST || '127.0.0.1',
        port: process.env.PROXY_PORT || '10809'
    },
    monitor: {
        volumeThreshold: parseFloat(process.env.VOLUME_THRESHOLD) || 2,
        minPriceChange: parseFloat(process.env.MIN_PRICE_CHANGE) || 0.1,
        minQuoteVolume: parseFloat(process.env.MIN_QUOTE_VOLUME) || 100000,
        checkInterval: parseInt(process.env.CHECK_INTERVAL) || 60000
    }
};

function validateConfig(config) {
    const required = {
        'TELEGRAM_BOT_TOKEN': config.telegram.botToken,
        'TELEGRAM_CHAT_ID': config.telegram.chatId
    };

    const missing = Object.entries(required)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

    if (missing.length > 0) {
        throw new Error(`缺少必要的配置项: ${missing.join(', ')}`);
    }

    // 验证数值类型的配置
    if (config.monitor.volumeThreshold <= 0) {
        throw new Error('VOLUME_THRESHOLD 必须大于0');
    }
    if (config.monitor.minPriceChange < 0) {
        throw new Error('MIN_PRICE_CHANGE 不能小于0');
    }
    if (config.monitor.minQuoteVolume <= 0) {
        throw new Error('MIN_QUOTE_VOLUME 必须大于0');
    }
    if (config.monitor.checkInterval < 5000) {
        throw new Error('CHECK_INTERVAL 不能小于5000毫秒');
    }
}

// 导出前先验证配置
validateConfig(config);
module.exports = config; 