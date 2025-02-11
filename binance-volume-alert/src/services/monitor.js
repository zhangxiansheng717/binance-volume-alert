const binanceService = require('./binance');
const telegramService = require('./telegram');

class MonitorService {
    constructor() {
        this.previousData = new Map();
        this.VOLUME_THRESHOLD = 1.05; // 成交量增加1.05倍触发提醒
        this.PRICE_CHANGE_THRESHOLD = 0.5; // 价格变化0.5%触发提醒
    }

    async start() {
        console.log('开始监控币安合约市场...');
        
        // 首次运行获取基准数据
        const initialData = await binanceService.getAllSymbolData();
        initialData.forEach(item => {
            this.previousData.set(item.symbol, {
                volume: parseFloat(item.volume),
                price: parseFloat(item.lastPrice)
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
            const currentPrice = parseFloat(item.lastPrice);
            
            const previous = this.previousData.get(symbol);
            if (previous) {
                const volumeChange = currentVolume / previous.volume;
                const priceChange = ((currentPrice - previous.price) / previous.price) * 100;

                // 如果成交量增加超过阈值
                if (volumeChange >= this.VOLUME_THRESHOLD) {
                    volumeIncreasedPairs.push({
                        symbol,
                        volumeChange: volumeChange.toFixed(2),
                        priceChange: priceChange.toFixed(2)
                    });

                    // 如果同时满足价格变化条件
                    if (Math.abs(priceChange) >= this.PRICE_CHANGE_THRESHOLD) {
                        alertPairs.push({
                            symbol,
                            volumeChange: volumeChange.toFixed(2),
                            priceChange: priceChange.toFixed(2)
                        });

                        // 发送提醒
                        await telegramService.sendAlert(
                            symbol,
                            currentPrice,
                            priceChange.toFixed(2),
                            volumeChange.toFixed(2)
                        );
                    }
                }
            }

            // 更新数据
            this.previousData.set(symbol, {
                volume: currentVolume,
                price: currentPrice
            });
        }

        // 输出统计信息
        console.log(`\n成交量增加超过 ${this.VOLUME_THRESHOLD} 倍的交易对: ${volumeIncreasedPairs.length} 个`);
        if (volumeIncreasedPairs.length > 0) {
            console.log('\n详细信息:');
            volumeIncreasedPairs.forEach(pair => {
                console.log(`${pair.symbol}: 成交量增加 ${pair.volumeChange} 倍, 价格变化 ${pair.priceChange}%`);
            });
        }

        console.log(`\n满足所有条件并发送提醒的交易对: ${alertPairs.length} 个`);
        if (alertPairs.length > 0) {
            console.log('\n已发送提醒的交易对:');
            alertPairs.forEach(pair => {
                console.log(`${pair.symbol}: 成交量增加 ${pair.volumeChange} 倍, 价格变化 ${pair.priceChange}%`);
            });
        }

        console.log('\n=== 市场检查完成 ===\n');
    }
}

module.exports = new MonitorService();