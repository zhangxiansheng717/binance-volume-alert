const binanceService = require('./binance');
const telegramService = require('./telegram');

class MonitorService {
    constructor() {
        this.previousData = new Map();
        this.VOLUME_THRESHOLD = 10; // 成交量增加10倍触发提醒
        this.MIN_PRICE_CHANGE = 0.1; // 价格至少上涨0.1%才触发提醒
        this.MIN_QUOTE_VOLUME = 100000; // 最低成交额限制（USDT）
        this.isChecking = false; // 添加检查状态标志
    }

    async start() {
        console.log('开始监控币安合约市场...');
        console.log(`最低成交额限制: ${this.MIN_QUOTE_VOLUME} USDT`);
        
        try {
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

            // 使用递归方式进行定时检查，而不是 setInterval
            this.scheduleNextCheck();
        } catch (error) {
            console.error('初始化失败:', error);
            process.exit(1);
        }
    }

    scheduleNextCheck() {
        setTimeout(async () => {
            if (!this.isChecking) {
                try {
                    await this.checkMarket();
                } catch (error) {
                    console.error('检查市场时出错:', error);
                }
            }
            this.scheduleNextCheck();
        }, 60 * 1000);
    }

    async checkMarket() {
        if (this.isChecking) return;
        this.isChecking = true;

        try {
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

                    if (volumeChange >= this.VOLUME_THRESHOLD && 
                        priceChange > this.MIN_PRICE_CHANGE && 
                        currentQuoteVolume >= this.MIN_QUOTE_VOLUME) {
                        
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

                        await telegramService.sendAlert(
                            symbol,
                            currentPrice,
                            priceChange.toFixed(2),
                            volumeChange.toFixed(2),
                            currentQuoteVolume.toFixed(2)
                        );
                    }
                }

                this.previousData.set(symbol, {
                    volume: currentVolume,
                    quoteVolume: currentQuoteVolume,
                    price: currentPrice,
                    time: item.time
                });
            }

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

            console.log('\n=== 市场检查完成 ===');
            console.log('等待下一次检查...\n');
        } catch (error) {
            console.error('检查过程中出错:', error);
        } finally {
            this.isChecking = false;
        }
    }
}

module.exports = new MonitorService();