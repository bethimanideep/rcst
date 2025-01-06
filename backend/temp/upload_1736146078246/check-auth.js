"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAuthFromCookie = exports.checkAuth = void 0;
const nodejs_commonjs_1 = require("@pnp/nodejs-commonjs");
const sp_commonjs_1 = require("@pnp/sp-commonjs");
const unauthorized_user_1 = require("../errors/unauthorized-user");
const logger_1 = require("../lib/logger");
const index_1 = require("../index");
const checkAuth = async (req, res, next) => {
    logger_1.logger.info("checkAuth: Request excecution started!!!");
    try {
        const SPToken = req.body.SPAppToken;
        logger_1.logger.info("Sharepoint App Token : " + SPToken);
        const SPSite = req.body.SPSiteUrl;
        logger_1.logger.info("Sharepoint Site : " + SPSite);
        const SiteList = req.query && req.query.sListId ? req.query.sListId.toString() : '';
        logger_1.logger.info("Sharepoint Site Library : " + SiteList);
        const ctx = await nodejs_commonjs_1.ProviderHostedRequestContext.create(SPSite, process.env.SP_CLIENTID, process.env.SP_CLIENTSECRET, SPToken);
        logger_1.logger.info("Sharepoint Context : " + JSON.stringify(ctx));
        const configOptions = await ctx.getUserConfig();
        // const configOptions  = {
        // headers:{"Authorization":`Bearer ${SPToken}`}}
        logger_1.logger.info("Sharepoint Config Options: " + JSON.stringify(configOptions));
        const userSP = new sp_commonjs_1.SPRest().configure(configOptions, SPSite);
        logger_1.logger.info("Sharepoint RestAPI context: " + JSON.stringify(userSP));
        let user = await userSP.web.currentUser();
        logger_1.logger.info("Sharepoint Context User: " + user.Title);
        req.userSP = userSP;
        req.user = user;
        res.cookie('SPAuthToken', SPToken, { expires: new Date(Number(new Date()) + 315360000000), httpOnly: true });
        res.cookie('SPSiteUrl', SPSite, { expires: new Date(Number(new Date()) + 315360000000), httpOnly: true });
        res.cookie('SiteLibrary', SiteList, { expires: new Date(Number(new Date()) + 315360000000), httpOnly: true });
    }
    catch (e) {
        console.log({ e });
        logger_1.logger.error((0, index_1.line)("Error:" + e));
        throw new unauthorized_user_1.UnAuthorizedError();
    }
    next();
};
exports.checkAuth = checkAuth;
const checkAuthFromCookie = async (req, res, next) => {
    logger_1.logger.info("checkAuthFromCookie: Request excecution started!!!");
    try {
        const SPToken = req.cookies.SPAuthToken;
        logger_1.logger.info("Sharepoint App Token : " + SPToken);
        const SPSite = req.cookies.SPSiteUrl;
        logger_1.logger.info("Sharepoint Site : " + SPSite);
        const ctx = await nodejs_commonjs_1.ProviderHostedRequestContext.create(SPSite, process.env.SP_CLIENTID, process.env.SP_CLIENTSECRET, SPToken);
        logger_1.logger.info("Sharepoint Context : " + JSON.stringify(ctx));
        const configOptions = await ctx.getUserConfig();
        // const configOptions  = {
        //     headers:{"Authorization":`Bearer ${SPToken}`}}
        logger_1.logger.info("Sharepoint Config Options: " + JSON.stringify(configOptions));
        const userSP = new sp_commonjs_1.SPRest().configure(configOptions, SPSite);
        logger_1.logger.info("Sharepoint RestAPI context: " + JSON.stringify(userSP));
        let user = await userSP.web.currentUser();
        logger_1.logger.info("Sharepoint Context User: " + user.Title);
        req.userSP = userSP;
        req.user = user;
    }
    catch (e) {
        logger_1.logger.error((0, index_1.line)("Error: " + e));
        throw new unauthorized_user_1.UnAuthorizedError();
    }
    next();
};
exports.checkAuthFromCookie = checkAuthFromCookie;
