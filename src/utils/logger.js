const fs = require('fs').promises;
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../../logs');
        this.init();
    }

    async init() {
        await fs.mkdir(this.logDir, { recursive: true });
    }

    async log(type, message) {
        const date = new Date().toISOString().split('T')[0];
        const logFile = path.join(this.logDir, `${date}.log`);
        const logMessage = `[${new Date().toISOString()}] [${type}] ${message}\n`;
        
        await fs.appendFile(logFile, logMessage);
        console.log(message);
    }
} 