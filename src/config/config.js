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

        
        // 多时间周期监控配置
        timeframes: {
            enabled: process.env.ENABLE_MULTI_TIMEFRAME === 'true' || true, // 默认启用
            intervals: [
                {
                    interval: '5m',
                    enabled: true,
                    priceThreshold: parseFloat(process.env.PRICE_THRESHOLD_5M) || 2.0,      // 价格阈值 2%
                    volumeThreshold: parseFloat(process.env.VOLUME_THRESHOLD_5M) || 2,
                    minQuoteVolume: parseFloat(process.env.MIN_QUOTE_VOLUME_5M) || 100000,
                    scheduleSeconds: 3,          // 在周期开始后第3秒检查
                    historyPeriods: 6,           // 历史基准周期数（30分钟）
                    volumeMedianPeriods: 20,     // 量能中位数计算周期
                    cooldownMinutes: 5           // 冷却时间（分钟）
                },
                {
                    interval: '15m',
                    enabled: process.env.ENABLE_15M !== 'false', // 默认启用
                    priceThreshold: parseFloat(process.env.PRICE_THRESHOLD_15M) || 3.0,     // 价格阈值 3%
                    volumeThreshold: parseFloat(process.env.VOLUME_THRESHOLD_15M) || 2.5,
                    minQuoteVolume: parseFloat(process.env.MIN_QUOTE_VOLUME_15M) || 300000,
                    scheduleSeconds: 10,         // 在周期开始后第10秒检查
                    historyPeriods: 6,           // 历史基准周期数（90分钟）
                    volumeMedianPeriods: 20,     // 量能中位数计算周期
                    cooldownMinutes: 5           // 冷却时间（分钟）
                },
                {
                    interval: '1h',
                    enabled: process.env.ENABLE_1H !== 'false', // 默认启用
                    priceThreshold: parseFloat(process.env.PRICE_THRESHOLD_1H) || 4.0,      // 价格阈值 4%
                    volumeThreshold: parseFloat(process.env.VOLUME_THRESHOLD_1H) || 3,
                    minQuoteVolume: parseFloat(process.env.MIN_QUOTE_VOLUME_1H) || 1000000,
                    scheduleSeconds: 30,         // 在周期开始后第30秒检查
                    historyPeriods: 6,           // 历史基准周期数（6小时）
                    volumeMedianPeriods: 20,     // 量能中位数计算周期
                    cooldownMinutes: 15          // 冷却时间（分钟）
                },
                {
                    interval: '4h',
                    enabled: process.env.ENABLE_4H !== 'false', // 默认启用
                    priceThreshold: parseFloat(process.env.PRICE_THRESHOLD_4H) || 5.5,      // 价格阈值 5.5%
                    volumeThreshold: parseFloat(process.env.VOLUME_THRESHOLD_4H) || 4,
                    minQuoteVolume: parseFloat(process.env.MIN_QUOTE_VOLUME_4H) || 5000000,
                    scheduleSeconds: 120,        // 在周期开始后第2分钟检查
                    historyPeriods: 6,           // 历史基准周期数（24小时）
                    volumeMedianPeriods: 20,     // 量能中位数计算周期
                    cooldownMinutes: 30          // 冷却时间（分钟）
                },
                {
                    interval: '1d',
                    enabled: process.env.ENABLE_1D !== 'false', // 默认启用
                    priceThreshold: parseFloat(process.env.PRICE_THRESHOLD_1D) || 8.0,      // 价格阈值 8%
                    volumeThreshold: parseFloat(process.env.VOLUME_THRESHOLD_1D) || 5,
                    minQuoteVolume: parseFloat(process.env.MIN_QUOTE_VOLUME_1D) || 10000000,
                    scheduleSeconds: 300,        // 在周期开始后第5分钟检查
                    historyPeriods: 6,           // 历史基准周期数（6天）
                    volumeMedianPeriods: 20,     // 量能中位数计算周期
                    cooldownMinutes: 60          // 冷却时间（分钟）
                }
            ]
        }
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

    // 验证多时间周期配置
    if (config.monitor.timeframes.enabled) {
        config.monitor.timeframes.intervals.forEach(tf => {
            if (tf.enabled) {
                if (tf.volumeThreshold <= 0) {
                    throw new Error(`${tf.interval} VOLUME_THRESHOLD 必须大于0`);
                }
                if (tf.minQuoteVolume <= 0) {
                    throw new Error(`${tf.interval} MIN_QUOTE_VOLUME 必须大于0`);
                }
            }
        });
    }

    // 验证原有的数值类型配置
    if (config.monitor.volumeThreshold <= 0) {
        throw new Error('VOLUME_THRESHOLD 必须大于0');
    }
    if (config.monitor.minPriceChange < 0) {
        throw new Error('MIN_PRICE_CHANGE 不能小于0');
    }
    if (config.monitor.minQuoteVolume <= 0) {
        throw new Error('MIN_QUOTE_VOLUME 必须大于0');
    }

}

module.exports = config;

try {
    validateConfig(config);
} catch (error) {
    console.error('配置验证失败:', error.message);
    process.exit(1);
}
