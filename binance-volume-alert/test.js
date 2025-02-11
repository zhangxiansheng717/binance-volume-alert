const telegramService = require('./src/services/telegram');

async function test() {
    console.log('正在发送测试消息...');
    await telegramService.testMessage();
}

test(); 