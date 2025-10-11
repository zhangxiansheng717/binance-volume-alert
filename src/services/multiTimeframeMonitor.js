const binanceService = require('./binance');
const telegramService = require('./telegram');
const config = require('../config/config');

class MultiTimeframeMonitorService {
    constructor() {
        this.recentSymbols = new Map(); // 存储各时间周期的最近币种数据
        this.isChecking = new Map(); // 存储各时间周期的检查状态
        this.scheduledJobs = new Map(); // 存储定时任务

        console.log('多时间周期监控服务初始化...');
        console.log('启用的时间周期:', 
            config.monitor.timeframes.intervals
                .filter(tf => tf.enabled)
                .map(tf => `${tf.interval}(阈值${tf.priceThreshold}%)`)
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
            
            console.log(`\n📋 ${timeframeName}周期 - 最近符合条件的前3个交易对:`);
            recentData.forEach((data, index) => {
                const direction = data.priceChange >= 0 ? '↗️上涨' : '↘️下跌';
                const intensityTag = data.x >= 3 ? '💥爆' : data.x >= 2 ? '⚡强' : '📊超阈';
                
                console.log(`${index + 1}. ${data.symbol} (${intensityTag})`);
                console.log(`   价格变动: ${data.priceChange >= 0 ? '+' : ''}${data.priceChange.toFixed(2)}% ${direction}`);
                console.log(`   强度 x: ${data.x.toFixed(2)}`);
                console.log(`   量能倍数: ${data.volumeMultiplier.toFixed(2)}x`);
                console.log(`   当前价格: ${data.lastPrice.toFixed(4)}`);
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
                
                // 初始化该时间周期的检查状态
                this.isChecking.set(dataKey, false);
                
                console.log(`${timeframeConfig.interval} 时间周期初始化完成，正在监控 ${initialData.length} 个交易对`);
                console.log(`  价格阈值: ${timeframeConfig.priceThreshold}%`);
                console.log(`  冷却时间: ${timeframeConfig.cooldownMinutes}分钟`);

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
        console.log(`\n⏰ 开始新一轮${timeframeName}周期市场检查...`);
        
        try {
            const currentData = await binanceService.getAllSymbolDataForTimeframe(timeframeConfig);
            const validData = currentData.filter(data => this.validateData(data));
            console.log(`📊 ${timeframeName}周期获取到 ${currentData.length} 个交易对，有效数据 ${validData.length} 个`);
            
            // 计算每个币种的涨幅（相对K线开盘价）
            const alertCandidates = [];
            
            for (const data of validData) {
                if (!data) continue;

                // 计算价格变动（相对K线开盘价）
                const priceChange = ((data.lastPrice - data.openPrice) / data.openPrice) * 100;
                
                // 检查是否达到阈值
                if (Math.abs(priceChange) >= timeframeConfig.priceThreshold) {
                    // 计算强度 x = |变动幅度| / 阈值
                    const x = Math.abs(priceChange) / timeframeConfig.priceThreshold;
                    
                    alertCandidates.push({
                        ...data,
                        priceChange,
                        x,
                        timeframeName
                    });
                }
            }
            
            // 按强度排序（x从大到小，x相同则按量能倍数）
            alertCandidates.sort((a, b) => {
                if (Math.abs(b.x - a.x) > 0.01) {
                    return b.x - a.x;
                }
                return b.volumeMultiplier - a.volumeMultiplier;
            });
            
            console.log(`🎯 发现 ${alertCandidates.length} 个符合阈值的交易对`);
            
            // 保存最近数据用于展示
            this.recentSymbols.set(dataKey, alertCandidates.slice(0, 3));
            
            // 发送提醒
            let alertCount = 0;
            let cooldownSkipped = 0;
            
            for (const data of alertCandidates) {
                const historyDesc = this.getHistoryPeriodDescription(
                    timeframeConfig.interval, 
                    timeframeConfig.historyPeriods
                );
                
                const direction = data.priceChange >= 0 ? '上涨' : '下跌';
                const volumeChange = data.volume / data.avgHistoricalVolume;
                
                console.log(`\n📈 ${data.symbol} (${timeframeName})`);
                console.log(`   开盘价: ${data.openPrice.toFixed(4)}`);
                console.log(`   当前价: ${data.lastPrice.toFixed(4)}`);
                console.log(`   价格变动: ${data.priceChange.toFixed(2)}% (${direction})`);
                console.log(`   强度 x: ${data.x.toFixed(2)}`);
                console.log(`   量能倍数: ${data.volumeMultiplier.toFixed(2)}x`);
                console.log(`   交易量变化: ${volumeChange.toFixed(2)}倍`);
                
                // 发送提醒（包含冷却检查）
                const sent = await telegramService.sendAlert({
                    symbol: data.symbol,
                    price: data.lastPrice.toFixed(4),
                    priceChange: data.priceChange,
                    interval: timeframeConfig.interval,
                    threshold: timeframeConfig.priceThreshold,
                    volumeMultiplier: data.volumeMultiplier,
                    cooldownMinutes: timeframeConfig.cooldownMinutes
                });
                
                if (sent) {
                    alertCount++;
                } else {
                    cooldownSkipped++;
                }
            }
            
            console.log(`\n✅ ${timeframeName}周期检查完成`);
            console.log(`   发送提醒: ${alertCount} 个`);
            console.log(`   冷却跳过: ${cooldownSkipped} 个`);
            this.displayRecentSymbols(timeframeConfig.interval);
            
        } catch (error) {
            console.error(`❌ 检查${timeframeName}周期交易对时发生错误:`, error);
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
