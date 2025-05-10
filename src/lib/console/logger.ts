class Logger {
    private prefix: string;

    constructor(prefix: string) {
        this.prefix = prefix;
    }

    debug(message: string, ...args: any[]): void {
        console.debug(`[${this.prefix}:debug] ${message}`, ...args);
    }

    info(message: string, ...args: any[]): void {
        console.info(`[${this.prefix}:info] ${message}`, ...args);
    }

    warning(message: string, ...args: any[]): void {
        console.warn(`[${this.prefix}:warn] ${message}`, ...args);
    }

    error(message: string, ...args: any[]): void {
        console.error(`[${this.prefix}:error] ${message}`, ...args);
    }
}

export default Logger;
