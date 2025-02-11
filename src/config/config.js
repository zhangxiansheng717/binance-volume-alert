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

module.exports = config; 