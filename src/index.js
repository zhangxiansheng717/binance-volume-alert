require('dotenv').config();
const config = require('./config/config');

async function main() {
    try {
        // 根据配置选择使用多时间周期监控还是单一时间周期监控
        if (config.monitor.timeframes.enabled) {
            console.log('启动多时间周期监控模式...');
            const multiTimeframeMonitor = require('./services/multiTimeframeMonitor');
            await multiTimeframeMonitor.start();
            
            // 优雅关闭处理
            process.on('SIGINT', () => {
                console.log('\n收到退出信号，正在关闭监控服务...');
                multiTimeframeMonitor.stop();
                process.exit(0);
            });
            
            process.on('SIGTERM', () => {
                console.log('\n收到终止信号，正在关闭监控服务...');
                multiTimeframeMonitor.stop();
                process.exit(0);
            });
        } else {
            console.log('启动单一时间周期监控模式（向后兼容）...');
            const monitor = require('./services/monitor');
            await monitor.start();
        }
    } catch (error) {
        console.error('Application error:', error);
        process.exit(1);
    }
}

main();