const binanceService = require('./binance');
const telegramService = require('./telegram');

class MonitorService {
    constructor() {
        this.previousData = new Map();
        this.VOLUME_THRESHOLD = 100; // 成交量增加100倍触发提醒
        this.MIN_PRICE_CHANGE = 0.1; // 价格至少上涨0.1%才触发提醒
    }

    async start() {
        console.log('开始监控币安合约市场...');
        
        // 首次运行获取基准数据
        const initialData = await binanceService.getAllSymbolData();
        initialData.forEach(item => {
            this.previousData.set(item.symbol, {
                volume: parseFloat(item.volume),
                quoteVolume: parseFloat(item.quoteVolume),
                price: parseFloat(item.lastPrice),
                time: item.time
            });
        });
        console.log(`初始化完成，正在监控 ${initialData.length} 个交易对`);

        // 每1分钟检查一次
        setInterval(async () => {
            await this.checkMarket();
        }, 60 * 1000);
    }

    async checkMarket() {
        console.log('\n=== 市场检查开始 ===');
        console.log(`检查时间: ${new Date().toLocaleString()}`);
        
        const currentData = await binanceService.getAllSymbolData();
        let volumeIncreasedPairs = [];
        let alertPairs = [];
        
        for (const item of currentData) {
            const symbol = item.symbol;
            const currentVolume = parseFloat(item.volume);
            const currentQuoteVolume = parseFloat(item.quoteVolume);
            const currentPrice = parseFloat(item.lastPrice);
            
            const previous = this.previousData.get(symbol);
            if (previous) {
                const volumeChange = currentVolume / previous.volume;
                const priceChange = ((currentPrice - previous.price) / previous.price) * 100;

                // 只在成交量增加且价格上涨时触发
                if (volumeChange >= this.VOLUME_THRESHOLD && priceChange > this.MIN_PRICE_CHANGE) {
                    const pairInfo = {
                        symbol,
                        volumeChange: volumeChange.toFixed(2),
                        priceChange: priceChange.toFixed(2),
                        currentVolume: currentVolume.toFixed(3),
                        previousVolume: previous.volume.toFixed(3),
                        currentQuoteVolume: currentQuoteVolume.toFixed(2),
                        previousQuoteVolume: previous.quoteVolume.toFixed(2),
                        currentPrice: currentPrice.toFixed(4),
                        previousPrice: previous.price.toFixed(4),
                        previousTime: previous.time,
                        currentTime: item.time
                    };

                    volumeIncreasedPairs.push(pairInfo);
                    alertPairs.push(pairInfo);

                    // 发送提醒
                    await telegramService.sendAlert(
                        symbol,
                        currentPrice,
                        priceChange.toFixed(2),
                        volumeChange.toFixed(2)
                    );
                }
            }

            // 更新数据
            this.previousData.set(symbol, {
                volume: currentVolume,
                quoteVolume: currentQuoteVolume,
                price: currentPrice,
                time: item.time
            });
        }

        // 输出统计信息
        console.log(`\n检测到 ${alertPairs.length} 个交易对符合条件：`);
        if (alertPairs.length > 0) {
            console.log('\n详细信息:');
            alertPairs.forEach(pair => {
                console.log(`\n${pair.symbol}:`);
                console.log(`时间对比: ${pair.previousTime} -> ${pair.currentTime}`);
                console.log(`成交量对比: ${pair.previousVolume} -> ${pair.currentVolume} (增加 ${pair.volumeChange} 倍)`);
                console.log(`成交额对比: ${pair.previousQuoteVolume} -> ${pair.currentQuoteVolume} USDT`);
                console.log(`价格对比: ${pair.previousPrice} -> ${pair.currentPrice} (上涨 ${pair.priceChange}%)`);
            });
        }

        console.log('\n=== 市场检查完成 ===\n');
    }
}

module.exports = new MonitorService();