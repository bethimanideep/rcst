"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalServerError = void 0;
const logger_1 = require("../lib/logger");
const ui_custom_error_1 = require("./ui-custom-error");
class InternalServerError extends ui_custom_error_1.UICustomError {
    constructor(message) {
        logger_1.logger.error("Connection Error");
        super();
        this.message = message;
        this.statusCode = 500;
        Object.setPrototypeOf(this, InternalServerError.prototype);
    }
    serializeError() {
        logger_1.logger.error("Internal Server Error!!");
        return {
            title: 'Internal Server Error',
            message: this.message
        };
    }
}
exports.InternalServerError = InternalServerError;
