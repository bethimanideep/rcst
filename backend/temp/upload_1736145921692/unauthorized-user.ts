import { logger } from "../lib/logger";
import { UICustomError } from "./ui-custom-error";
import { line } from "../index";

export class UnAuthorizedError extends UICustomError{
    statusCode = 400
    constructor(){
        super()
        Object.setPrototypeOf(this,UnAuthorizedError.prototype)
    }
    serializeError(): { title: string; message: string; } {
        logger.error("Access Error: User not permitted to access this page. Please contact administrator.");
        return {
            title: 'User Not Authorized',
            message: 'User not permitted to access this page. Please contact administrator.'
        }
    }
}