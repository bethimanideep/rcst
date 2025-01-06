"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnAuthorizedError = void 0;
const logger_1 = require("../lib/logger");
const ui_custom_error_1 = require("./ui-custom-error");
class UnAuthorizedError extends ui_custom_error_1.UICustomError {
    constructor() {
        super();
        this.statusCode = 400;
        Object.setPrototypeOf(this, UnAuthorizedError.prototype);
    }
    serializeError() {
        logger_1.logger.error("Access Error: User not permitted to access this page. Please contact administrator.");
        return {
            title: 'User Not Authorized',
            message: 'User not permitted to access this page. Please contact administrator.'
        };
    }
}
exports.UnAuthorizedError = UnAuthorizedError;
