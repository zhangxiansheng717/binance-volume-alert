const telegramService = require('./src/services/telegram');
const config = require('./src/config/config');

async function test() {
    console.log('正在测试 Telegram 配置...');
    
    // 打印完整配置信息
    console.log('配置信息:', {
        botToken: config.telegram.botToken ? '已设置 (长度:' + config.telegram.botToken.length + ')' : '未设置',
        chatId: config.telegram.chatId,
        代理设置: {
            使用代理: config.proxy.use,
            代理地址: config.proxy.host,
            代理端口: config.proxy.port
        }
    });

    try {
        const result = await telegramService.testMessage();
        if (result) {
            console.log('测试成功！');
        } else {
            console.log('测试失败！');
        }
    } catch (error) {
        console.error('错误详情:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        
        if (error.response) {
            console.error('Telegram API 响应:', {
                status: error.response.status,
                data: error.response.data
            });
        }
    }
}

test(); 