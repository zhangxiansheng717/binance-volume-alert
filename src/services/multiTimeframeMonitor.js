const binanceService = require('./binance');
const telegramService = require('./telegram');
const config = require('../config/config');

class MultiTimeframeMonitorService {
    constructor() {
        this.previousData = new Map(); // 存储各时间周期的历史价格数据
        this.recentSymbols = new Map(); // 存储各时间周期的最近币种数据
        this.isChecking = new Map(); // 存储各时间周期的检查状态
        this.scheduledJobs = new Map(); // 存储定时任务
        this.MIN_PRICE_CHANGE = parseFloat(config.monitor.minPriceChange);

        console.log('多时间周期监控服务初始化...');
        console.log('启用的时间周期:', 
            config.monitor.timeframes.intervals
                .filter(tf => tf.enabled)
                .map(tf => tf.interval)
                .join(', ')
        );
    }

    getTimeframeName(interval) {
        const names = {
            '5m': '5分钟',
            '15m': '15分钟', 
            '1h': '1小时',
            '4h': '4小时',
            '1d': '1日'
        };
        return names[interval] || interval;
    }

    getHistoryPeriodDescription(interval, periods) {
        const multipliers = {
            '5m': periods * 5,
            '15m': periods * 15,
            '1h': periods * 60,
            '4h': periods * 240,
            '1d': periods * 1440
        };
        
        const totalMinutes = multipliers[interval];
        if (totalMinutes < 60) {
            return `${totalMinutes}分钟`;
        } else if (totalMinutes < 1440) {
            return `${Math.floor(totalMinutes / 60)}小时`;
        } else {
            return `${Math.floor(totalMinutes / 1440)}天`;
        }
    }

    displayRecentSymbols(interval) {
        const recentData = this.recentSymbols.get(interval);
        if (recentData && recentData.length > 0) {
            const timeframeName = this.getTimeframeName(interval);
            const historyDesc = this.getHistoryPeriodDescription(
                interval, 
                recentData[0].timeframeConfig.historyPeriods
            );
            
            console.log(`\n${timeframeName}周期 - 最近3个币种数据:`);
            recentData.forEach((data, index) => {
                console.log(`${index + 1}. ${data.symbol}`);
                console.log(`   最新完整${timeframeName}交易量: ${data.volume.toFixed(2)} 个`);
                console.log(`   前${historyDesc}平均交易量: ${data.avgHistoricalVolume.toFixed(2)} 个`);
                console.log(`   交易量变化倍数: ${(data.volume / data.avgHistoricalVolume).toFixed(2)}倍`);
                console.log(`   当前价格: ${data.lastPrice}`);
                console.log(`   ${timeframeName}成交额: ${data.quoteVolume.toFixed(2)} USDT`);
            });
            console.log('------------------------');
        }
    }

    async start() {
        if (!config.monitor.timeframes.enabled) {
            console.log('多时间周期监控已禁用，使用原有单一时间周期监控');
            return;
        }

        console.log('开始启动多时间周期监控...');

        // 为每个启用的时间周期启动监控
        for (const timeframeConfig of config.monitor.timeframes.intervals) {
            if (!timeframeConfig.enabled) {
                console.log(`跳过 ${timeframeConfig.interval} 时间周期（已禁用）`);
                continue;
            }

            console.log(`初始化 ${timeframeConfig.interval} 时间周期监控...`);
            
            try {
                // 首次运行获取基准数据
                const initialData = await binanceService.getAllSymbolDataForTimeframe(timeframeConfig);
                const dataKey = timeframeConfig.interval;
                
                // 初始化该时间周期的数据
                const priceData = new Map();
                initialData.forEach(item => {
                    priceData.set(item.symbol, {
                        lastPrice: parseFloat(item.lastPrice),
                        time: item.time
                    });
                });
                
                this.previousData.set(dataKey, priceData);
                this.isChecking.set(dataKey, false);
                
                console.log(`${timeframeConfig.interval} 时间周期初始化完成，正在监控 ${initialData.length} 个交易对`);

                // 启动定时检查
                this.scheduleNextCheck(timeframeConfig);
                
            } catch (error) {
                console.error(`${timeframeConfig.interval} 时间周期初始化失败:`, error);
            }
        }
    }

    getNextInterval(timeframeConfig) {
        const now = new Date();
        const nextTime = new Date(now);

        // 根据不同时间周期计算下一个检查时间
        switch (timeframeConfig.interval) {
            case '5m':
                nextTime.setMinutes(Math.ceil(now.getMinutes() / 5) * 5);
                break;
            case '15m':
                nextTime.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
                break;
            case '1h':
                nextTime.setHours(now.getHours() + 1);
                nextTime.setMinutes(0);
                break;
            case '4h':
                const nextHour = Math.ceil(now.getHours() / 4) * 4;
                nextTime.setHours(nextHour);
                nextTime.setMinutes(0);
                break;
            case '1d':
                nextTime.setDate(now.getDate() + 1);
                nextTime.setHours(0);
                nextTime.setMinutes(0);
                break;
        }

        nextTime.setSeconds(timeframeConfig.scheduleSeconds);
        nextTime.setMilliseconds(0);
        
        // 如果计算出的时间已经过去，就加一个周期
        if (nextTime <= now) {
            switch (timeframeConfig.interval) {
                case '5m':
                    nextTime.setMinutes(nextTime.getMinutes() + 5);
                    break;
                case '15m':
                    nextTime.setMinutes(nextTime.getMinutes() + 15);
                    break;
                case '1h':
                    nextTime.setHours(nextTime.getHours() + 1);
                    break;
                case '4h':
                    nextTime.setHours(nextTime.getHours() + 4);
                    break;
                case '1d':
                    nextTime.setDate(nextTime.getDate() + 1);
                    break;
            }
        }
        
        return nextTime.getTime() - now.getTime();
    }

    scheduleNextCheck(timeframeConfig) {
        const waitTime = this.getNextInterval(timeframeConfig);
        const nextCheckTime = new Date(Date.now() + waitTime);
        const timeframeName = this.getTimeframeName(timeframeConfig.interval);
        
        console.log(`${timeframeName}周期下次检查时间: ${nextCheckTime.toLocaleString()}`);
        
        const jobId = setTimeout(async () => {
            const dataKey = timeframeConfig.interval;
            if (!this.isChecking.get(dataKey)) {
                try {
                    await this.checkSymbols(timeframeConfig);
                } catch (error) {
                    console.error(`${timeframeName}周期检查市场时出错:`, error);
                }
            }
            this.scheduleNextCheck(timeframeConfig);
        }, waitTime);

        this.scheduledJobs.set(timeframeConfig.interval, jobId);
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

    async checkSymbols(timeframeConfig) {
        const dataKey = timeframeConfig.interval;
        const timeframeName = this.getTimeframeName(timeframeConfig.interval);
        
        if (this.isChecking.get(dataKey)) {
            console.log(`${timeframeName}周期上一次检查还未完成，跳过本次检查`);
            return;
        }

        this.isChecking.set(dataKey, true);
        console.log(`\n开始新一轮${timeframeName}周期市场检查...`);
        
        try {
            const currentData = await binanceService.getAllSymbolDataForTimeframe(timeframeConfig);
            const validData = currentData.filter(data => this.validateData(data));
            console.log(`${timeframeName}周期获取到 ${currentData.length} 个交易对，有效数据 ${validData.length} 个`);
            
            // 深拷贝最近3个币种数据
            this.recentSymbols.set(dataKey, validData.slice(0, 3).map(data => ({
                symbol: data.symbol,
                interval: data.interval,
                volume: data.volume,
                avgHistoricalVolume: data.avgHistoricalVolume,
                lastPrice: data.lastPrice,
                quoteVolume: data.quoteVolume,
                timeframeConfig: data.timeframeConfig
            })));
            
            let alertCount = 0;
            const previousPriceData = this.previousData.get(dataKey);
            
            for (const data of validData) {
                if (!data) continue;

                const volumeChange = data.volume / data.avgHistoricalVolume;
                
                if (volumeChange >= timeframeConfig.volumeThreshold && 
                    data.quoteVolume >= timeframeConfig.minQuoteVolume) {
                    
                    const previousPrice = previousPriceData?.get(data.symbol)?.lastPrice;
                    if (!previousPrice) {
                        // 只保存必要的数据
                        if (!previousPriceData.has(data.symbol)) {
                            previousPriceData.set(data.symbol, {
                                lastPrice: data.lastPrice,
                                time: data.time
                            });
                        }
                        continue;
                    }

                    const priceChange = ((data.lastPrice - previousPrice) / previousPrice) * 100;

                    if (priceChange >= this.MIN_PRICE_CHANGE) {
                        const historyDesc = this.getHistoryPeriodDescription(
                            timeframeConfig.interval, 
                            timeframeConfig.historyPeriods
                        );
                        
                        console.log(`\n发现${timeframeName}周期异常交易对:`);
                        console.log(`币种: ${data.symbol}`);
                        console.log(`时间周期: ${timeframeName}`);
                        console.log(`时间: ${data.time}`);
                        console.log(`最新完整${timeframeName}交易量: ${data.volume.toFixed(2)} 个`);
                        console.log(`前${historyDesc}平均交易量: ${data.avgHistoricalVolume.toFixed(2)} 个`);
                        console.log(`交易量变化: ${volumeChange.toFixed(2)}倍`);
                        console.log(`价格变化: ${priceChange.toFixed(2)}%`);
                        console.log(`${timeframeName}成交额: ${data.quoteVolume.toFixed(2)} USDT`);
                        console.log('------------------------');

                        await telegramService.sendAlert(
                            `${data.symbol} (${timeframeName})`,
                            data.lastPrice.toFixed(4),
                            priceChange.toFixed(2),
                            volumeChange.toFixed(2),
                            data.quoteVolume.toFixed(2),
                            timeframeName
                        );
                        alertCount++;
                    }
                }

                // 更新价格数据
                previousPriceData.set(data.symbol, {
                    lastPrice: data.lastPrice,
                    time: data.time
                });
            }
            
            console.log(`\n${timeframeName}周期检查完成`);
            console.log(`发送提醒: ${alertCount} 个`);
            this.displayRecentSymbols(timeframeConfig.interval);
            
        } catch (error) {
            console.error(`检查${timeframeName}周期交易对时发生错误:`, error);
        } finally {
            this.isChecking.set(dataKey, false);
        }
    }

    stop() {
        console.log('正在停止多时间周期监控...');
        for (const [interval, jobId] of this.scheduledJobs.entries()) {
            clearTimeout(jobId);
            console.log(`已停止 ${interval} 时间周期监控`);
        }
        this.scheduledJobs.clear();
    }
}

module.exports = new MultiTimeframeMonitorService(); 