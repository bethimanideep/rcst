import { logger } from "../lib/logger";
import { UICustomError } from "./ui-custom-error";
import { line } from "../index"

export class DatabaseConnectionError extends UICustomError{
    statusCode = 500
    constructor(){
        super()
        Object.setPrototypeOf(this,DatabaseConnectionError.prototype)
    }
    serializeError(): { title: string; message: string; } {
        logger.error("Database Connection Error!!");
        return {
            title: 'Internal Server Error',
            message: 'Server failed to respond.Please try again after sometime'
        }
    }
}