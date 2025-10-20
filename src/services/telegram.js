const TelegramBot = require('node-telegram-bot-api');
const config = require('../config/config');
const { HttpsProxyAgent } = require('https-proxy-agent');

class TelegramService {
    constructor() {
        const options = { polling: false };
        
        // 如果启用了代理，添加代理配置
        if (config.proxy.use) {
            const proxyUrl = `http://${config.proxy.host}:${config.proxy.port}`;
            options.request = {
                agent: new HttpsProxyAgent(proxyUrl)
            };
            console.log('Telegram 使用代理:', proxyUrl);
        }

        this.bot = new TelegramBot(config.telegram.botToken, options);
        this.chatId = config.telegram.chatId;
        
        // 每日提醒次数统计（按 symbol+interval+direction 分组）
        this.dailyAlertCount = new Map(); // key: "symbol_interval_direction", value: count
        this.lastResetDate = new Date().toDateString();
        
        // 冷却机制：记录最后提醒时间
        this.cooldownMap = new Map(); // key: "symbol_interval_direction", value: lastAlertTime
        
        // 启动每日重置定时器
        this.startDailyReset();
    }

    // 每日重置提醒次数
    resetDailyCount() {
        const today = new Date().toDateString();
        if (today !== this.lastResetDate) {
            console.log(`\n🔄 重置每日提醒次数统计 (${today})`);
            this.dailyAlertCount.clear();
            this.lastResetDate = today;
        }
    }

    // 启动每日重置定时器（每小时检查一次）
    startDailyReset() {
        setInterval(() => {
            this.resetDailyCount();
        }, 60 * 60 * 1000); // 每小时检查
    }

    // 检查是否在冷却期
    isInCooldown(symbol, interval, direction, cooldownMinutes) {
        const key = `${symbol}_${interval}_${direction}`;
        const lastAlertTime = this.cooldownMap.get(key);
        
        if (!lastAlertTime) return false;
        
        const now = Date.now();
        const cooldownMs = cooldownMinutes * 60 * 1000;
        return (now - lastAlertTime) < cooldownMs;
    }
    
    // 记录提醒时间（更新冷却）
    recordAlertTime(symbol, interval, direction) {
        const key = `${symbol}_${interval}_${direction}`;
        this.cooldownMap.set(key, Date.now());
    }
    
    // 获取并增加提醒次数
    getAndIncrementAlertCount(symbol, interval, direction) {
        this.resetDailyCount(); // 每次调用时检查是否需要重置
        
        const key = `${symbol}_${interval}_${direction}`;
        const count = this.dailyAlertCount.get(key) || 0;
        const newCount = count + 1;
        this.dailyAlertCount.set(key, newCount);
        return newCount;
    }
    
    // 计算强度等级
    calculateIntensity(priceChange, threshold, volumeMultiplier) {
        const x = Math.abs(priceChange) / threshold;
        const volumeQualified = volumeMultiplier >= 2.0;
        
        // x < 2：无强度
        if (x < 2) {
            return { level: 'none', tag: '', x: x.toFixed(1), show: false };
        }
        
        // x >= 3 且量能达标：💥爆
        if (x >= 3 && volumeQualified) {
            return { level: 'explosive', tag: '💥爆', x: x.toFixed(1), show: true };
        }
        
        // 2 <= x < 3 且量能达标：⚡强
        if (x >= 2 && x < 3 && volumeQualified) {
            return { level: 'strong', tag: '⚡强', x: x.toFixed(1), show: true };
        }
        
        // 其他情况：仅超阈（不显示强度行）
        return { level: 'threshold', tag: '', x: x.toFixed(1), show: false };
    }

    async sendAlert(alertData) {
        const { symbol, price, priceChange, interval, threshold, volumeMultiplier, cooldownMinutes,
                rsi, ema7, ema25, atr, trend, resistance } = alertData;
        
        // 判断涨跌方向
        const direction = priceChange >= 0 ? '上涨' : '下跌';
        const directionKey = priceChange >= 0 ? 'up' : 'down';
        const changeSymbol = priceChange >= 0 ? '+' : '';
        
        // 检查冷却
        if (this.isInCooldown(symbol, interval, directionKey, cooldownMinutes)) {
            console.log(`⏸️  ${symbol} (${interval}) ${direction} 在冷却期内，跳过提醒`);
            return false;
        }
        
        // 计算强度
        const intensity = this.calculateIntensity(priceChange, threshold, volumeMultiplier);
        
        // 获取提醒次数
        const alertCount = this.getAndIncrementAlertCount(symbol, interval, directionKey);
        
        // 记录提醒时间（启动冷却）
        this.recordAlertTime(symbol, interval, directionKey);
        
        // 格式化时间（手动格式化，确保24小时制）
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');  // 24小时制
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');
        const timeStr = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        
        // 格式化价格（保留完整精度）
        const priceValue = parseFloat(price);
        let formattedPrice;
        if (priceValue < 0.001) {
            formattedPrice = priceValue.toFixed(8);
        } else if (priceValue < 0.01) {
            formattedPrice = priceValue.toFixed(6);
        } else if (priceValue < 1) {
            formattedPrice = priceValue.toFixed(4);
        } else if (priceValue < 1000) {
            formattedPrice = priceValue.toFixed(2);
        } else {
            formattedPrice = priceValue.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
        
        // 周期颜色标识
        const intervalEmoji = {
            '5m': '🔴',
            '15m': '🟡',
            '1h': '🟢',
            '4h': '🔵',
            '1d': '⚪'
        };
        const intervalDisplay = `${intervalEmoji[interval] || '⚫'} ${interval}`;
        
        // RSI状态（根据涨跌方向判断）
        let rsiStatus;
        if (priceChange > 0) {  // 上涨时
            rsiStatus = rsi >= 70 ? '⚠️ 超买' : 
                       rsi >= 50 ? '✅ 强势' : 
                       rsi >= 30 ? '📊 中性' : '💡 超卖';
        } else {  // 下跌时
            rsiStatus = rsi >= 70 ? '⚠️ 仍偏强' : 
                       rsi >= 50 ? '📊 未超卖' : 
                       rsi >= 30 ? '💡 接近超卖' : '💡 超卖';
        }
        
        // 趋势显示
        const trendEmoji = trend === 'up' ? '🚀' : '📉';
        const trendText = trend === 'up' ? '多头排列' : '空头排列';
        
        // 量能等级
        const volumeTag = volumeMultiplier >= 3 ? '💥 爆量' :
                         volumeMultiplier >= 2 ? '⚡ 放量' :
                         volumeMultiplier >= 1 ? '📊 正常' : '⚠️ 缩量';
        
        // 动态确定小数位数（根据价格大小）
        const currentPrice = parseFloat(price);
        let priceDecimals = 2;
        if (currentPrice < 0.001) {
            priceDecimals = 8;  // 极小币种 0.00012345
        } else if (currentPrice < 0.01) {
            priceDecimals = 6;  // 0.001-0.01: 0.003910
        } else if (currentPrice < 0.1) {
            priceDecimals = 5;  // 0.01-0.1: 0.03910
        } else if (currentPrice < 1) {
            priceDecimals = 4;  // 0.1-1: 0.3910
        } else if (currentPrice < 10) {
            priceDecimals = 3;  // 1-10: 3.910
        } else if (currentPrice < 100) {
            priceDecimals = 2;  // 10-100: 39.10
        } else {
            priceDecimals = 1;  // >100: 391.0
        }
        
        // 确保EMA值也使用相同精度（防止显示0）
        const ema7Display = ema7 > 0 ? ema7 : currentPrice;
        const ema25Display = ema25 > 0 ? ema25 : currentPrice;
        
        // 智能判断支撑阻力位（确保支撑<当前价<阻力）
        let supportLevel, resistanceLevel, supportLabel, resistanceLabel;
        
        // 简化逻辑：只用EMA作为关键参考位
        if (currentPrice > ema25Display) {
            // 多头：价格在EMA25上方
            supportLevel = ema25Display;
            supportLabel = 'EMA25';
            resistanceLevel = resistance;
            resistanceLabel = '前高';
        } else if (currentPrice > ema7Display && currentPrice <= ema25Display) {
            // 中间：价格在EMA7和EMA25之间
            supportLevel = ema7Display;
            supportLabel = 'EMA7';
            resistanceLevel = ema25Display;
            resistanceLabel = 'EMA25';
        } else {
            // 空头：价格在EMA7下方（极弱）
            // 显示最近的反弹目标
            supportLevel = currentPrice * 0.95;  // 下方5%作为参考
            supportLabel = '近期低位';
            resistanceLevel = Math.min(ema7Display, ema25Display);
            resistanceLabel = resistanceLevel === ema7Display ? 'EMA7' : 'EMA25';
        }
        
        // 综合评级（更严格的逻辑）
        let rating = 'C';
        let ratingEmoji = '⚠️';
        let suggestion = '观望';
        let detailedReasons = [];  // 详细原因
        let operationTips = [];    // 操作建议
        let riskWarning = '';      // 风险警示
        
        if (priceChange > 0) {  // 上涨
            // A级：趋势+量能+RSI都配合
            if (trend === 'up' && volumeMultiplier >= 2 && rsi >= 40 && rsi < 70) {
                rating = 'A';
                ratingEmoji = '✅';
                suggestion = '可以做多';
                
                detailedReasons.push(`✓ 顺势上涨：价格沿着上涨趋势运行，不是乱涨`);
                detailedReasons.push(`✓ 真实买盘：成交量是平时的${volumeMultiplier.toFixed(1)}倍，有真金白银在买入`);
                detailedReasons.push(`✓ 还有空间：RSI只有${rsi.toFixed(0)}，离超买(70)还远，后续还能涨`);
                
                operationTips.push(`• 入场点：当前价附近 (${formattedPrice})`);
                operationTips.push(`• 止损位：跌破支撑 ${supportLevel.toFixed(priceDecimals)}`);
                operationTips.push(`• 目标位：阻力位 ${resistanceLevel.toFixed(priceDecimals)}`);
                operationTips.push(`• 仓位：建议10-20%试探性建仓`);
            }
            // B级：有一定优势但不完美
            else if (trend === 'up' && volumeMultiplier >= 1.5 && rsi < 75) {
                rating = 'B';
                ratingEmoji = '📊';
                suggestion = '可以关注';
                
                detailedReasons.push(`✓ 趋势向上：整体是多头趋势`);
                if (volumeMultiplier >= 2) {
                    detailedReasons.push(`✓ 量能尚可：成交量${volumeMultiplier.toFixed(1)}倍，有一定资金`);
                } else {
                    detailedReasons.push(`⚠ 量能一般：成交量${volumeMultiplier.toFixed(1)}倍，追高需谨慎`);
                }
                if (rsi >= 70) {
                    detailedReasons.push(`⚠ RSI偏高：RSI ${rsi.toFixed(0)}接近超买，注意回调`);
                }
                
                operationTips.push(`• 建议：等待回调到支撑位再考虑`);
                operationTips.push(`• 支撑位：${supportLevel.toFixed(priceDecimals)}`);
            }
            // C级：有明显风险
            else {
                rating = 'C';
                ratingEmoji = '⚠️';
                suggestion = '不建议追高';
                
                if (trend === 'down') {
                    detailedReasons.push(`✗ 逆势反弹：整体趋势是下跌，这只是临时反弹`);
                }
                if (volumeMultiplier < 1.5) {
                    detailedReasons.push(`✗ 量能很弱：成交量只有${volumeMultiplier.toFixed(1)}倍，买盘不足`);
                    
                    // 智能警示系统（根据不同情况生成针对性警示）
                    const priceChangeAbs = Math.abs(priceChange);
                    
                    // 场景1：庄家对敲拉盘（大涨幅+小量能）
                    if (priceChangeAbs > 10 && volumeMultiplier < 1.3) {
                        riskWarning = `⚠️ 庄家对敲警示:\n`;
                        riskWarning += `涨幅${priceChangeAbs.toFixed(1)}%但量能只有${volumeMultiplier.toFixed(1)}倍，这是典型的庄家对敲操作：\n`;
                        riskWarning += `• 庄家用很少的钱（左手倒右手）拉高价格\n`;
                        riskWarning += `• 制造"暴涨"假象，吸引散户FOMO追高\n`;
                        riskWarning += `• 散户一买入，庄家立刻砸盘出货\n`;
                        riskWarning += `• 结果：您会被套在山顶，庄家全身而退\n`;
                        riskWarning += `💀 风险等级：极高 - 强烈建议远离！`;
                    }
                    // 场景2：中等涨幅但量能衰减
                    else if (priceChangeAbs >= 6 && priceChangeAbs <= 10 && volumeMultiplier < 1.5) {
                        riskWarning = `⚠️ 追高风险警示:\n`;
                        riskWarning += `涨幅${priceChangeAbs.toFixed(1)}%但量能只有${volumeMultiplier.toFixed(1)}倍，说明：\n`;
                        riskWarning += `• 前期可能有资金拉升，但现在买盘在减弱\n`;
                        riskWarning += `• 主力可能已经不买了，现在是散户在接盘\n`;
                        riskWarning += `• 这种情况往往是惯性上涨的尾声\n`;
                        riskWarning += `💡 建议：等回调再考虑，别追高接盘`;
                    }
                    // 场景3：缩量拉升（量能<1x）
                    else if (volumeMultiplier < 1.0) {
                        riskWarning = `⚠️ 缩量上涨警示:\n`;
                        riskWarning += `成交量${volumeMultiplier.toFixed(1)}倍，比平时还少！说明：\n`;
                        riskWarning += `• 几乎没有真实买盘，可能是盘子太小随便拉\n`;
                        riskWarning += `• 或者是自动交易机器人在做市\n`;
                        riskWarning += `• 这种涨法不健康，随时可能反转\n`;
                        riskWarning += `💡 建议：别碰，流动性太差`;
                    }
                }
                
                // 场景4：逆势暴涨（空头+大涨幅）
                if (trend === 'down' && priceChangeAbs > 8) {
                    if (!riskWarning) {  // 如果还没有警示
                        riskWarning = `⚠️ 逆势暴涨警示:\n`;
                        riskWarning += `下跌趋势中突然暴涨${priceChangeAbs.toFixed(1)}%，这通常是：\n`;
                        riskWarning += `• 庄家诱多：利用散户抄底心理，拉高出货\n`;
                        riskWarning += `• 短暂反弹：下跌趋势未改，反弹很快结束\n`;
                        riskWarning += `• 多头陷阱：诱使散户做多，然后继续下跌\n`;
                        riskWarning += `💡 建议：不要被假突破迷惑，等趋势真正转多再说`;
                    }
                }
                
                // 场景5：超买追高（RSI>85）
                if (rsi >= 85 && !riskWarning) {
                    riskWarning = `⚠️ 超买追高警示:\n`;
                    riskWarning += `RSI高达${rsi.toFixed(0)}，严重超买！说明：\n`;
                    riskWarning += `• 短期涨幅过大，价格已经透支\n`;
                    riskWarning += `• 随时会出现技术性回调（5-15%的跌幅）\n`;
                    riskWarning += `• 现在追高就是"最后一棒"，风险极大\n`;
                    riskWarning += `💡 建议：千万别追！等回调到RSI 50以下再考虑`;
                }
                
                // 场景6：小币种异常（价格<0.1 + 大涨幅）
                if (currentPrice < 0.1 && priceChangeAbs > 12 && !riskWarning) {
                    riskWarning = `⚠️ 小币种风险警示:\n`;
                    riskWarning += `小币种（价格${formattedPrice}）暴涨${priceChangeAbs.toFixed(1)}%：\n`;
                    riskWarning += `• 小币种盘子小，容易被操纵\n`;
                    riskWarning += `• 流动性差，买得进卖不出\n`;
                    riskWarning += `• 暴涨暴跌是常态，风险极高\n`;
                    riskWarning += `💡 建议：新手远离小币种，专注主流币`;
                }
                if (rsi >= 70) {
                    detailedReasons.push(`✗ RSI超买：RSI高达${rsi.toFixed(0)}，已经超买，随时回调`);
                }
                if (rsi < 40) {
                    detailedReasons.push(`✗ RSI太弱：RSI只有${rsi.toFixed(0)}，上涨动能不足`);
                }
                
                operationTips.push(`• 建议：远离这个币，等趋势明确再说`);
                if (volumeMultiplier < 1.5 && Math.abs(priceChange) > 8) {
                    operationTips.push(`• 警告：这种涨法很危险，十有八九是诱多`);
                }
            }
        } else {  // 下跌
            // A级：超卖反弹机会
            if (rsi <= 30 && volumeMultiplier >= 2) {
                rating = 'A';
                ratingEmoji = '💡';
                suggestion = '可抄底';
                
                detailedReasons.push(`✓ RSI超卖：RSI只有${rsi.toFixed(0)}，跌过头了，反弹概率大`);
                detailedReasons.push(`✓ 放量下跌：成交量${volumeMultiplier.toFixed(1)}倍，恐慌盘在出清`);
                detailedReasons.push(`✓ 超跌反弹：跌得越狠，反弹越猛`);
                
                operationTips.push(`• 抄底策略：分批建仓，别一次买太多`);
                operationTips.push(`• 第1批：当前价买10-20%`);
                operationTips.push(`• 第2批：再跌3-5%加仓`);
                operationTips.push(`• 止损：跌破支撑位 ${supportLevel.toFixed(priceDecimals)}`);
            }
            // B级：多头回调或接近超卖
            else if ((trend === 'up' && rsi >= 40 && rsi <= 65) || (rsi <= 40 && volumeMultiplier >= 1.5)) {
                rating = 'B';
                ratingEmoji = '📊';
                suggestion = '可观察';
                
                if (trend === 'up' && rsi >= 40 && rsi <= 65) {
                    detailedReasons.push(`✓ 健康回调：整体是上涨趋势，这是正常调整`);
                    detailedReasons.push(`✓ 趋势未破：回调幅度不大，多头趋势仍在`);
                    detailedReasons.push(`✓ RSI未超卖：RSI ${rsi.toFixed(0)}还算健康，说明只是调整`);
                    
                    operationTips.push(`• 建议：等跌到支撑位 ${supportLevel.toFixed(priceDecimals)} 附近`);
                    operationTips.push(`• 如果支撑位稳住（不再跌），可以考虑买入`);
                } else {
                    detailedReasons.push(`✓ RSI偏低：RSI ${rsi.toFixed(0)}接近超卖区域`);
                    if (volumeMultiplier >= 2) {
                        detailedReasons.push(`✓ 放量下跌：可能快见底了`);
                    }
                }
            }
            // C级：继续下跌风险
            else {
                rating = 'C';
                ratingEmoji = '⚠️';
                suggestion = '先别买';
                
                const priceChangeAbs = Math.abs(priceChange);
                
                if (rsi > 65) {
                    detailedReasons.push(`✗ RSI还高：RSI ${rsi.toFixed(0)}还没超卖，说明还会跌`);
                }
                if (volumeMultiplier < 1.5) {
                    detailedReasons.push(`✗ 量能不足：成交量只有${volumeMultiplier.toFixed(1)}倍，抄底买盘很弱`);
                }
                if (trend === 'down' && rsi > 50) {
                    detailedReasons.push(`✗ 空头趋势：下跌趋势还没结束`);
                }
                
                // 下跌场景警示
                // 场景7：阴跌不止（量能<1x）
                if (volumeMultiplier < 1.0 && priceChangeAbs > 5) {
                    riskWarning = `⚠️ 阴跌不止警示:\n`;
                    riskWarning += `缩量下跌${priceChangeAbs.toFixed(1)}%（量能${volumeMultiplier.toFixed(1)}倍）：\n`;
                    riskWarning += `• 没有恐慌抛售，而是慢慢阴跌\n`;
                    riskWarning += `• 说明没人愿意抄底，市场信心不足\n`;
                    riskWarning += `• 这种跌法往往持续很久，跌幅更大\n`;
                    riskWarning += `💡 建议：别急着抄底，等真正放量暴跌后再说`;
                }
                // 场景8：空头趋势持续下跌
                else if (trend === 'down' && rsi > 50 && priceChangeAbs > 5) {
                    if (!riskWarning) {
                        riskWarning = `⚠️ 空头趋势警示:\n`;
                        riskWarning += `下跌趋势中继续跌${priceChangeAbs.toFixed(1)}%，且RSI还有${rsi.toFixed(0)}：\n`;
                        riskWarning += `• 下跌趋势未改变，这不是底部\n`;
                        riskWarning += `• RSI还没到超卖区，说明跌势未尽\n`;
                        riskWarning += `• 抄底要等RSI到30以下，才有反弹机会\n`;
                        riskWarning += `💡 建议：耐心等待，不要试图接住下跌的刀`;
                    }
                }
                
                operationTips.push(`• 建议：先别买，等RSI跌到30以下再考虑`);
                operationTips.push(`• 或者等趋势转为多头排列`);
            }
        }
        
        // 构建消息
        const countText = ` 第${alertCount}次提醒`;
        let message = `📊 合约价格异动提醒（${symbol}${countText}）\n\n`;
        message += `交易对: ${symbol}\n`;
        message += `周期: ${intervalDisplay}\n`;
        message += `变动幅度: ${changeSymbol}${Math.abs(priceChange).toFixed(2)}% (${direction})\n`;
        message += `阈值: ${threshold}%\n`;
        message += `当前价格: ${formattedPrice}\n\n`;
        
        // 技术分析
        message += `📈 技术分析:\n`;
        message += `• RSI(14): ${rsi.toFixed(0)} ${rsiStatus}\n`;
        message += `• MA趋势: ${trendEmoji} ${trendText}\n`;
        message += `• EMA7: ${ema7Display.toFixed(priceDecimals)} | EMA25: ${ema25Display.toFixed(priceDecimals)}\n`;
        message += `• 量能: ${volumeTag} ${volumeMultiplier.toFixed(1)}x\n\n`;
        
        // 参考位置（智能判断最接近的支撑阻力）
        message += `💰 参考位置:\n`;
        message += `• 支撑位: $${supportLevel.toFixed(priceDecimals)} (${supportLabel})\n`;
        message += `• 阻力位: $${resistanceLevel.toFixed(priceDecimals)} (${resistanceLabel})\n\n`;
        
        // 综合评级
        message += `💡 综合评级: ${rating}级信号\n`;
        message += `${ratingEmoji} 建议方向: ${suggestion}\n`;
        
        // 详细分析
        if (detailedReasons.length > 0) {
            message += `\n📝 详细分析:\n`;
            detailedReasons.forEach(reason => {
                message += `${reason}\n`;
            });
        }
        
        // 庄家操作警示（仅在C级且满足条件时显示）
        if (riskWarning) {
            message += `\n${riskWarning}\n`;
        }
        
        // 操作建议
        if (operationTips.length > 0) {
            message += `\n💰 操作建议:\n`;
            operationTips.forEach(tip => {
                message += `${tip}\n`;
            });
        }
        
        message += `\n时间: ${timeStr}`;

        try {
            await this.bot.sendMessage(this.chatId, message, {
                disable_notification: intensity.level === 'threshold'
            });
            
            const intensityDesc = intensity.show ? `${intensity.tag} x${intensity.x}` : '仅超阈';
            console.log(`✅ 已发送提醒: ${symbol} (${interval}) ${direction} ${intensityDesc} (今日第${alertCount}次)`);
            return true;
        } catch (error) {
            console.error('发送 Telegram 消息失败:', error.message);
            console.error('完整错误:', error);
            return false;
        }
    }

    async testMessage() {
        // 手动格式化时间（确保24小时制）
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');  // 24小时制
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');
        const timeStr = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        
        const message = `🤖 测试消息\n` +
            `时间：${timeStr}\n` +
            `如果你收到这条消息，说明 Telegram 机器人配置正确！`;

        try {
            const result = await this.bot.sendMessage(this.chatId, message);
            console.log('测试消息发送成功！');
            return true;
        } catch (error) {
            // 如果错误是 EFATAL 和 socket hang up，但消息可能已发送
            if (error.message.includes('socket hang up')) {
                console.log('警告: 连接中断，但消息可能已发送成功');
                return true;
            }
            console.error('发送测试消息失败:', error.message);
            return false;
        }
    }
}

module.exports = new TelegramService();

