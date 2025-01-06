import { logger } from "../lib/logger";
import { UICustomError } from "./ui-custom-error";
import { line } from "../index";

export class InternalServerError extends UICustomError{
    statusCode = 500
    constructor(public message: string){
        logger.error("Connection Error");
        super()
        Object.setPrototypeOf(this,InternalServerError.prototype)
    }
    serializeError(): { title: string; message: string; } {
        logger.error("Internal Server Error!!");
        return {
            title: 'Internal Server Error',
            message: this.message
        }
    }
}