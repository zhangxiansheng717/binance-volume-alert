const binanceService = require('./binance');
const telegramService = require('./telegram');
const config = require('../config/config');

class MonitorService {
    constructor() {
        this.previousData = new Map();
        this.VOLUME_THRESHOLD = parseFloat(config.monitor.volumeThreshold);
        this.MIN_PRICE_CHANGE = parseFloat(config.monitor.minPriceChange);
        this.MIN_QUOTE_VOLUME = parseFloat(config.monitor.minQuoteVolume);
        this.isChecking = false;
        this.recentSymbols = []; // 存储最近3个币种的数据
        this.maxHistorySize = 1000; // 限制历史数据大小

        console.log('监控参数:', {
            成交量阈值: this.VOLUME_THRESHOLD + '倍',
            价格变化: this.MIN_PRICE_CHANGE + '%',
            最小成交额: this.MIN_QUOTE_VOLUME + ' USDT'
        });
    }

    displayRecentSymbols() {
        if (this.recentSymbols.length > 0) {
            console.log('\n最近3个币种数据:');
            this.recentSymbols.forEach((data, index) => {
                console.log(`${index + 1}. ${data.symbol}`);
                console.log(`   当前5分钟成交额: ${data.volume.toFixed(2)} USDT`);
                console.log(`   前30分钟平均成交额: ${data.avgHistoricalVolume.toFixed(2)} USDT`);
                console.log(`   成交额变化倍数: ${(data.volume / data.avgHistoricalVolume).toFixed(2)}倍`);
                console.log(`   当前价格: ${data.lastPrice}`);
            });
            console.log('------------------------');
        }
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
                    await this.checkSymbols();
                } catch (error) {
                    console.error('检查市场时出错:', error);
                }
            }
            this.scheduleNextCheck();
        }, 60 * 1000);
    }

    validateData(data) {
        return data && 
               typeof data.volume === 'number' && 
               typeof data.lastPrice === 'number' &&
               typeof data.avgHistoricalVolume === 'number' &&
               data.volume > 0 &&
               data.lastPrice > 0 &&
               data.avgHistoricalVolume > 0;
    }

    async checkSymbols() {
        if (this.isChecking) {
            console.log('上一次检查还未完成，跳过本次检查');
            return;
        }

        this.isChecking = true;
        console.log('\n开始新一轮市场检查...');
        console.log('当前时间:', new Date().toLocaleString());
        
        try {
            const currentData = await binanceService.getAllSymbolData();
            // 过滤无效数据
            const validData = currentData.filter(data => this.validateData(data));
            console.log(`本轮获取到 ${currentData.length} 个交易对，有效数据 ${validData.length} 个`);
            
            // 更新最近3个币种数据
            this.recentSymbols = validData.slice(0, 3);
            
            // 添加调试信息
            console.log(`已保存最近 ${this.recentSymbols.length} 个币种数据`);
            
            let alertCount = 0;
            for (const data of validData) {
                if (!data) continue;

                const volumeChange = data.volume / data.avgHistoricalVolume;
                
                if (volumeChange >= this.VOLUME_THRESHOLD && 
                    data.quoteVolume >= this.MIN_QUOTE_VOLUME) {
                    
                    const previousPrice = this.previousData.get(data.symbol)?.lastPrice;
                    if (!previousPrice) {
                        this.previousData.set(data.symbol, data);
                        continue;
                    }

                    const priceChange = ((data.lastPrice - previousPrice) / previousPrice) * 100;

                    if (priceChange >= this.MIN_PRICE_CHANGE) {
                        console.log('\n发现异常交易对:');
                        console.log(`币种: ${data.symbol}`);
                        console.log(`时间: ${data.time}`);
                        console.log(`成交量变化: ${volumeChange.toFixed(2)}倍`);
                        console.log(`价格变化: ${priceChange.toFixed(2)}%`);
                        console.log(`成交额: ${data.quoteVolume.toFixed(2)} USDT`);
                        console.log('------------------------');

                        await telegramService.sendAlert(
                            data.symbol,
                            data.lastPrice.toFixed(4),
                            priceChange.toFixed(2),
                            volumeChange.toFixed(2),
                            data.quoteVolume.toFixed(2)
                        );
                        alertCount++;
                    }
                }

                this.previousData.set(data.symbol, data);
            }
            
            console.log(`\n本轮检查完成`);
            console.log(`发送提醒: ${alertCount} 个`);
            
            // 添加调试信息
            console.log('准备显示最近币种数据...');
            console.log('recentSymbols 长度:', this.recentSymbols.length);
            if (this.recentSymbols.length > 0) {
                console.log('第一个币种数据:', this.recentSymbols[0]);
            }
            
            this.displayRecentSymbols();
            console.log('------------------------');

            // 清理历史数据
            this.cleanupHistory();
        } catch (error) {
            console.error('检查交易对时发生错误:', error);
        } finally {
            this.isChecking = false;
        }
    }

    cleanupHistory() {
        if (this.previousData.size > this.maxHistorySize) {
            const entries = Array.from(this.previousData.entries());
            const toDelete = entries.slice(0, entries.length - this.maxHistorySize);
            toDelete.forEach(([key]) => this.previousData.delete(key));
            console.log(`清理历史数据 ${toDelete.length} 条`);
        }
    }
}

module.exports = new MonitorService();