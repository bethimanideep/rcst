import winston from "winston";
import DailyRotateFile from 'winston-daily-rotate-file';
import path from "path";
import * as dotenv from 'dotenv'
dotenv.config(); 

const logFormat = winston.format.combine(
 winston.format.timestamp({format: 'DD-MM-YYYY hh:mm:ss.SSS A'}),
 winston.format.simple(),
 winston.format.align(),
 winston.format.printf(info => `${info.level.toUpperCase()} : ${info.timestamp} ==> ${info.message}`,),);

const transport = new DailyRotateFile({
filename: path.join(__dirname,'../','../','logs','%DATE% - SPAconex.log'),
 datePattern: 'DD-MM-YYYY',
 zippedArchive: true,
//  maxSize: '20m',
//  maxFiles: '14d',
 level: process.env.LOG_LEVEL 
});

transport.on('rotate', function (oldFilename, newFilename) {});

export const logger = winston.createLogger({
format: logFormat,
transports: [
     transport,
     new winston.transports.Console({level: process.env.LOG_LEVEL}),
]});

