class Logger {
    private prefix: string;

    constructor(prefix: string) {
        this.prefix = prefix;
    }

    debug(message: string, ...args: any[]): void {
        console.debug(`[${this.prefix}] ${message}`, ...args);
    }

    info(message: string, ...args: any[]): void {
        console.info(`[${this.prefix}] ${message}`, ...args);
    }

    warning(message: string, ...args: any[]): void {
        console.warn(`[${this.prefix}] ${message}`, ...args);
    }

    error(message: string, ...args: any[]): void {
        console.error(`[${this.prefix}] ${message}`, ...args);
    }
}

export default Logger;
