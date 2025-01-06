"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UICustomError = void 0;
class UICustomError extends Error {
    constructor() {
        super();
        Object.setPrototypeOf(this, UICustomError.prototype);
    }
}
exports.UICustomError = UICustomError;
