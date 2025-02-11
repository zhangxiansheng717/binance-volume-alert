const { exec } = require('child_process');
const path = require('path');

// 项目根目录
const rootDir = path.resolve(__dirname, '..');

function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, { cwd: rootDir }, (error, stdout, stderr) => {
            if (error) {
                console.error(`执行错误: ${error}`);
                reject(error);
                return;
            }
            console.log(stdout);
            resolve(stdout);
        });
    });
}

async function update() {
    try {
        console.log('开始更新...');
        
        // 拉取最新代码
        await runCommand('git pull');
        
        // 安装依赖
        await runCommand('npm install');
        
        // 重启服务
        await runCommand('pm2 restart binance-monitor');
        
        console.log('更新完成！');
    } catch (error) {
        console.error('更新失败:', error);
    }
}

// 每小时检查更新一次
setInterval(update, 60 * 60 * 1000);

// 立即执行一次更新
update();

console.log('更新监控已启动');

 