import { ISiteGroupInfo, SPRest } from "@pnp/sp-commonjs";
import { NextFunction, Request, Response } from "express";
import { UnAuthorizedError } from "../errors/unauthorized-user";

export const checkControllerUser = async (req: Request,res: Response, next: NextFunction) => {
    try{
        const userSP: SPRest = req.userSP
        let groups: ISiteGroupInfo[] = await userSP.web.currentUser.groups();
        let exists = false;
        for(let g of groups){
            if(g.Title === process.env.SPSITE_CONFIG_GROUP){
                exists = true
                break;
            }
        }
        if(!exists){
            throw new UnAuthorizedError()
        }
    }catch(e){
        throw new UnAuthorizedError()
    }
    next();
}