import { NextFunction, Request, Response } from "express";
import { UICustomError } from "../errors/ui-custom-error";
import {logger} from '../lib/logger'
import { line } from '../index';

export const ErrorHandler = (err: Error, req: Request,res: Response, next: NextFunction) => {
    logger.error(line("Error Handler"))
    logger.error(line(err))
    if(err instanceof UICustomError){
        logger.error(line(err.serializeError()))
        return res.status(err.statusCode).render('error',err.serializeError())
    }
    return res.status(400).send({
        error: "Something went wrong"
    })
}