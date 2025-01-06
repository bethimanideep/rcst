"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseConnectionError = void 0;
const logger_1 = require("../lib/logger");
const ui_custom_error_1 = require("./ui-custom-error");
class DatabaseConnectionError extends ui_custom_error_1.UICustomError {
    constructor() {
        super();
        this.statusCode = 500;
        Object.setPrototypeOf(this, DatabaseConnectionError.prototype);
    }
    serializeError() {
        logger_1.logger.error("Database Connection Error!!");
        return {
            title: 'Internal Server Error',
            message: 'Server failed to respond.Please try again after sometime'
        };
    }
}
exports.DatabaseConnectionError = DatabaseConnectionError;
