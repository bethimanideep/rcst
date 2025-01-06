import { IConfigOptions } from '@pnp/common';
import { ProviderHostedRequestContext } from "@pnp/nodejs-commonjs";
import { ISiteGroupInfo, SPRest } from "@pnp/sp-commonjs";
import { ISiteUserInfo } from '@pnp/sp-commonjs/site-users/types';
import { NextFunction, Request, Response } from "express";
import { UnAuthorizedError } from "../errors/unauthorized-user";
import { logger } from '../lib/logger';
import { line } from '../index';

declare global{
    namespace Express{
        interface Request{
            user: ISiteUserInfo,
            userSP: SPRest
        }
    }
}

export const checkAuth = async (req: Request,res: Response, next: NextFunction) => {
    logger.info("checkAuth: Request excecution started!!!")
    try
    {
        const SPToken: string = req.body.SPAppToken;
        logger.info("Sharepoint App Token : "+ SPToken)
        const SPSite: string = req.body.SPSiteUrl;
        logger.info("Sharepoint Site : "+ SPSite)
        const SiteList: string = req.query && req.query.sListId ?req.query.sListId.toString(): '';
        logger.info("Sharepoint Site Library : "+ SiteList)
        // const ctx: ProviderHostedRequestContext = await ProviderHostedRequestContext.create(SPSite, process.env.SP_CLIENTID!, process.env.SP_CLIENTSECRET!, SPToken);
        // logger.info("Sharepoint Context : "+ JSON.stringify(ctx))
        // const configOptions: IConfigOptions  = await ctx.getUserConfig();
        const configOptions  = {
        headers:{"Authorization":`Bearer ${SPToken}`}}
        logger.info("Sharepoint Config Options: "+ JSON.stringify(configOptions))
        const userSP: SPRest = new SPRest().configure(configOptions, SPSite);
        logger.info("Sharepoint RestAPI context: "+ JSON.stringify(userSP))
        let user: ISiteUserInfo = await userSP.web.currentUser();
        logger.info("Sharepoint Context User: "+ user.Title)
        req.userSP = userSP;
        req.user = user;
        res.cookie('SPAuthToken',SPToken, { expires: new Date(Number(new Date()) + 315360000000), httpOnly: true });
        res.cookie('SPSiteUrl',SPSite, { expires: new Date(Number(new Date()) + 315360000000), httpOnly: true });
        res.cookie('SiteLibrary',SiteList, { expires: new Date(Number(new Date()) + 315360000000), httpOnly: true });
    }
    catch(e: any)
    {        
        console.log({e});
        
        logger.error(line("Error:"+ e))
        throw new UnAuthorizedError()
    }
    next();
}

export const checkAuthFromCookie = async (req: Request,res: Response, next: NextFunction) => {
    logger.info("checkAuthFromCookie: Request excecution started!!!")
    try{
        const SPToken: string = req.cookies.SPAuthToken;
        logger.info("Sharepoint App Token : "+ SPToken)
        const SPSite: string = req.cookies.SPSiteUrl;
        logger.info("Sharepoint Site : "+ SPSite)
        // const ctx: ProviderHostedRequestContext = await ProviderHostedRequestContext.create(SPSite, process.env.SP_CLIENTID!, process.env.SP_CLIENTSECRET!, SPToken);
        // logger.info("Sharepoint Context : "+ JSON.stringify(ctx))
        // const configOptions: IConfigOptions  = await ctx.getUserConfig()
        const configOptions  = {
            headers:{"Authorization":`Bearer ${SPToken}`}}
        logger.info("Sharepoint Config Options: "+ JSON.stringify(configOptions))
        const userSP: SPRest = new SPRest().configure(configOptions, SPSite);
        logger.info("Sharepoint RestAPI context: "+ JSON.stringify(userSP))
        let user: ISiteUserInfo = await userSP.web.currentUser();
        logger.info("Sharepoint Context User: "+ user.Title)
        req.userSP = userSP
        req.user = user;
    }
    catch(e: any)
    {
        logger.error(line("Error: "+ e))
        throw new UnAuthorizedError()
    }
    next();
}