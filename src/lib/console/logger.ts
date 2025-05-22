import chalk from 'chalk';

class Logger {
    private prefix: string;

    constructor(prefix: string) {
        this.prefix = prefix;
    }

    debug(message: string, ...args: any[]): void {
        console.debug(chalk.blue(`[${this.prefix}:debug] ${message}`), ...args);
    }

    info(message: string, ...args: any[]): void {
        console.info(chalk.green(`[${this.prefix}:info] ${message}`), ...args);
    }

    warning(message: string, ...args: any[]): void {
        console.warn(chalk.yellow(`[${this.prefix}:warn] ${message}`), ...args);
    }

    error(message: string, ...args: any[]): void {
        console.error(chalk.red(`[${this.prefix}:error] ${message}`), ...args);
    }
}

export default Logger;
