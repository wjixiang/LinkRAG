import winston from 'winston';

const createLoggerWithPrefix = (prefix: string) => {
  const logger = winston.createLogger({
    level: 'debug', // Set a base level, transports can override
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message }) => {
        return `[${prefix}:${level}] ${message}`;
      })
    ),
    transports: [
      new winston.transports.Console()
    ]
  });

  return logger;
};

export default createLoggerWithPrefix;
