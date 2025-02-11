require('dotenv').config();
const monitor = require('./services/monitor');

async function main() {
    try {
        await monitor.start();
    } catch (error) {
        console.error('Application error:', error);
    }
}

main();