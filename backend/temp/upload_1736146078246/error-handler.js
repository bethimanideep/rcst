"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = void 0;
const ui_custom_error_1 = require("../errors/ui-custom-error");
const logger_1 = require("../lib/logger");
const index_1 = require("../index");
const ErrorHandler = (err, req, res, next) => {
    logger_1.logger.error((0, index_1.line)("Error Handler"));
    logger_1.logger.error((0, index_1.line)(err));
    if (err instanceof ui_custom_error_1.UICustomError) {
        logger_1.logger.error((0, index_1.line)(err.serializeError()));
        return res.status(err.statusCode).render('error', err.serializeError());
    }
    return res.status(400).send({
        error: "Something went wrong"
    });
};
exports.ErrorHandler = ErrorHandler;
