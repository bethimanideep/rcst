"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbPool = void 0;
const mssql = __importStar(require("mssql"));
const database_connection_error_1 = require("../errors/database-connection-error");
const password_1 = require("./password");
const logger_1 = require("../lib/logger");
class ConnectToDatabase {
    get pool() {
        return this._pool;
    }
    async connect() {
        try {
            logger_1.logger.info("Connecting to MSSQL");
            var config = {
                user: process.env.DB_USER,
                password: (0, password_1.decryptedPassword)(process.env.DB_PASSWORD),
                server: process.env.DB_HOST || '',
                database: process.env.DB_NAME,
                port: parseInt(process.env.DB_PORT),
                options: {
                    encrypt: false,
                    trustServerCertificate: true
                }
            };
            logger_1.logger.info("DB Configurations Details " + JSON.stringify(config));
            this._pool = await new mssql.ConnectionPool(config).connect();
            logger_1.logger.info("Connected to MSSQL");
            return this._pool;
        }
        catch (err) {
            logger_1.logger.info("DB Connection Error: " + err.message);
            throw new database_connection_error_1.DatabaseConnectionError();
        }
    }
}
const dbPool = new ConnectToDatabase();
exports.dbPool = dbPool;
const DatabaseConnect = async () => {
    return new Promise((resolve, reject) => { resolve(dbPool.pool); });
};
exports.default = DatabaseConnect;
