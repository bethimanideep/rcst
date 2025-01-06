"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentPull = void 0;
const axios_1 = __importDefault(require("axios"));
const express_1 = __importDefault(require("express"));
const types_1 = require("../types/types");
const database_1 = __importDefault(require("../shared/database"));
const xml2js_1 = require("xml2js");
const common_1 = require("../shared/common");
const check_auth_1 = require("../middlewares/check-auth");
const db_operations_1 = require("../shared/db-operations");
const internal_server_error_1 = require("../errors/internal-server-error");
const check_access_user_1 = require("../middlewares/check-access-user");
const password_1 = require("../shared/password");
const logger_1 = require("../lib/logger");
const index_1 = require("../index");
const router = express_1.default.Router();
exports.DocumentPull = router;
router.post("/aconex/pull", check_auth_1.checkAuthFromCookie, check_access_user_1.checkAccessUser, async (req, res) => {
    logger_1.logger.info("PULL FROM ACONEX: Connecting To Database");
    const mssql = await (0, database_1.default)();
    if (mssql) {
        try {
            logger_1.logger.info("PULL FROM ACONEX: Connected To Database");
            const SiteList = req.cookies.SiteLibrary;
            logger_1.logger.info("PULL FROM ACONEX:Site Library ID: " + SiteList);
            const userSP = req.userSP;
            let user = req.user;
            const SPSite = req.cookies.SPSiteUrl;
            const library = await userSP.web.lists.getById(SiteList).select("Title")();
            logger_1.logger.info("PULL FROM ACONEX: Site Library: " + library.Title);
            let config;
            let instanceDetails;
            let project;
            let aconexAttributes;
            config = await (0, db_operations_1.getSiteProfileSetting)(mssql, SPSite, library.Title);
            logger_1.logger.info("PULL FROM ACONEX: Aconex SP Configuration: " + JSON.stringify(config));
            //below
            instanceDetails = await (0, db_operations_1.getAconexInstanceDetails)(mssql, config.AconexInstanceURL, config.AconexInstanceName);
            logger_1.logger.info("PULL FROM ACONEX: Aconex Instance Details: " + JSON.stringify(instanceDetails));
            //below
            project = await (0, db_operations_1.getAconexProjectDetails)(mssql, config.AconexInstanceURL, config.AconexProjectID, config.AconexInstanceName);
            logger_1.logger.info("PULL FROM ACONEX: Aconex Project : " + JSON.stringify(project));
            aconexAttributes = await (0, db_operations_1.getAconexAttributes)(mssql);
            logger_1.logger.info("PULL FROM ACONEX: Aconex Project : " + JSON.stringify(aconexAttributes));
            const mapping = JSON.parse(config.MetadataMapping);
            const spItemIds = req.body.spItemIds;
            let fileResponse = [];
            if (spItemIds.length > 0) {
                logger_1.logger.info("PULL FROM ACONEX: Looping through the documents ids");
                for (let i of spItemIds) {
                    logger_1.logger.info("PULL FROM ACONEX: Document: " + JSON.stringify(i));
                    if (i.action === types_1.DocumentPullActions.EXISTS) {
                        let syncObj = await (0, common_1.pullDocument)(i.item, i.docNo, userSP, user, config, instanceDetails, mssql, library, aconexAttributes, mapping, project);
                        logger_1.logger.info("PULL FROM ACONEX: Pull Document response: " + JSON.stringify(syncObj));
                        fileResponse.push(Object.assign(Object.assign({}, syncObj), { item: i.item }));
                    }
                }
            }
            res.send(fileResponse);
        }
        catch (err) {
            logger_1.logger.error((0, index_1.line)(err.message));
            throw new internal_server_error_1.InternalServerError(err);
        }
    }
});
router.post("/pull", check_auth_1.checkAuth, check_access_user_1.checkAccessUser, async (req, res) => {
    logger_1.logger.info("PULL VIEW: Connecting to Database");
    const mssql = await (0, database_1.default)();
    if (mssql) {
        logger_1.logger.info("PULL VIEW: Connected to Database");
        const SiteList = req.query && req.query.sListId ? req.query.sListId.toString() : '';
        logger_1.logger.info("PULL VIEW:Site Library ID: " + SiteList);
        const userSP = req.userSP;
        let user = req.user;
        const SPSite = req.body.SPSiteUrl;
        const spItemIds = req.query && req.query.sItemId ? req.query.sItemId.toString().split(',') : '';
        logger_1.logger.info("PULL VIEW: Document IDs: " + JSON.stringify(spItemIds));
        const library = await userSP.web.lists.getById(SiteList).select("Title")();
        logger_1.logger.info("PULL VIEW:Site Library: " + library.Title);
        let config;
        let instanceDetails;
        let project;
        let aconexAttributes;
        config = await (0, db_operations_1.getSiteProfileSetting)(mssql, SPSite, library.Title);
        logger_1.logger.info("PULL VIEW: Aconex SP Configuration: " + JSON.stringify(config));
        //below
        instanceDetails = await (0, db_operations_1.getAconexInstanceDetails)(mssql, config.AconexInstanceURL, config.AconexInstanceName);
        logger_1.logger.info("PULL VIEW: Aconex Instance Details: " + JSON.stringify(instanceDetails));
        //below
        project = await (0, db_operations_1.getAconexProjectDetails)(mssql, config.AconexInstanceURL, config.AconexProjectID, config.AconexInstanceName);
        logger_1.logger.info("PULL VIEW: Aconex Project : " + JSON.stringify(project));
        aconexAttributes = await (0, db_operations_1.getAconexAttributes)(mssql);
        logger_1.logger.info("PULL VIEW: Aconex Attributes : " + JSON.stringify(aconexAttributes));
        const mapping = JSON.parse(config.MetadataMapping);
        let keys = Object.keys(mapping);
        let fileDetails = [];
        let promiseArray = [];
        logger_1.logger.info("PULL VIEW: Looping through documents");
        for (let spItemId of spItemIds) {
            var responsePromise = new Promise(async (resolve, reject) => {
                try {
                    const list = await userSP.web.lists.getByTitle(library.Title).items.getById(parseInt(spItemId)).select('File').expand("File").get();
                    const spFileInfo = list.File;
                    logger_1.logger.info("PULL VIEW: File Name: " + spFileInfo.Name);
                    const metadata = await userSP.web.getFolderByServerRelativePath(spFileInfo.ServerRelativeUrl).listItemAllFields();
                    logger_1.logger.info("PULL VIEW: " + spFileInfo.Name + " File Metadata: " + JSON.stringify(metadata));
                    const versionHistory = await userSP.web.lists.getByTitle(library.Title).items.getById(parseInt(spItemId)).select('Versions').expand('Versions').get();
                    let spversion = parseInt(versionHistory.Versions[0].VersionLabel);
                    let acxversioninSP = parseInt(metadata.AconexVersion);
                    let documentNo = '';
                    logger_1.logger.info("PULL VIEW: " + spFileInfo.Name + " SP Version No.: " + spversion);
                    for (let k of keys) {
                        const attrindex = aconexAttributes.findIndex(a => a.CreateIdentifier === k);
                        if (attrindex > -1) {
                            let attributeValue = metadata[mapping[k]];
                            if (k === 'DocumentNumber') {
                                documentNo = attributeValue ? attributeValue.toString() : '';
                            }
                        }
                    }
                    logger_1.logger.info("PULL VIEW: " + spFileInfo.Name + " Document No.: " + documentNo);
                    let action = types_1.DocumentPullActions.NOTEXISTS;
                    let ackversion;
                    let message = '';
                    if (documentNo != '') {
                        logger_1.logger.info("PULL VIEW: " + spFileInfo.Name + " Searching file in Aconex ");
                        const fileSearch = await axios_1.default.get(`${instanceDetails.AconexURL}/api/projects/${config.AconexProjectID}/register?search_query=docno:${documentNo}&return_fields=versionnumber`, {
                            auth: {
                                username: instanceDetails.ServiceAccountName,
                                password: (0, password_1.decryptedPassword)(instanceDetails.Password)
                            }
                        });
                        const r = await (0, xml2js_1.parseStringPromise)(fileSearch.data);
                        if (r.RegisterSearch && r.RegisterSearch.SearchResults && r.RegisterSearch.$.TotalResults != '0' && r.RegisterSearch.SearchResults.length > 0 && r.RegisterSearch.SearchResults[0].Document[0]) {
                            logger_1.logger.info("PULL VIEW: " + spFileInfo.Name + " File found in Aconex");
                            ackversion = r.RegisterSearch.SearchResults[0].Document[0].VersionNumber[0];
                            logger_1.logger.info("PULL VIEW: " + spFileInfo.Name + " Aconex Version No.: " + ackversion);
                            if (parseInt(ackversion) > acxversioninSP) {
                                logger_1.logger.info("PULL VIEW: " + spFileInfo.Name + " can be pulled from Aconex.");
                                action = types_1.DocumentPullActions.EXISTS;
                                message = types_1.Messages.PULL;
                            }
                            else {
                                logger_1.logger.info("PULL VIEW: " + spFileInfo.Name + " is already up to date in Aconex.");
                                action = types_1.DocumentPullActions.UPDATED,
                                    message = types_1.Messages.UPDATED;
                            }
                        }
                        else {
                            logger_1.logger.info("PULL VIEW: " + spFileInfo.Name + " does not exists on Aconex.");
                            ackversion = '';
                            action = types_1.DocumentPullActions.NOTEXISTS;
                            message = types_1.Messages.NOTAVAILABLE;
                        }
                    }
                    else {
                        logger_1.logger.info("PULL VIEW: " + spFileInfo.Name + " does not exists on Aconex.");
                        action = types_1.DocumentPullActions.NOTEXISTS;
                        message = types_1.Messages.DOCNOREQUIRED;
                    }
                    let viewDetails = { documentNo: documentNo, revision: metadata.Revision, spVersion: acxversioninSP, ackVersion: ackversion, documentName: spFileInfo.Name, action: action, instance: instanceDetails.InstanceName, projectName: project.ProjectName, project: config.AconexProjectID, site: config.SharepointSite, itemId: Number(spItemId), operation: types_1.OperationActions.PULL, message: message, user: user.Title };
                    logger_1.logger.info("PULL VIEW: " + spFileInfo.Name + " Data to view." + JSON.stringify(viewDetails));
                    resolve(viewDetails);
                }
                catch (err) {
                    logger_1.logger.error((0, index_1.line)("PULL VIEW: Failed to get document details ID: " + spItemId + " with error: " + err.message));
                    reject(types_1.Messages.ERRORDOCFETCH);
                }
            });
            promiseArray.push(responsePromise);
        }
        try {
            fileDetails = await Promise.all(promiseArray);
        }
        catch (err) {
            logger_1.logger.error("PULL VIEW: Failed to get the Documents: " + err.message);
            throw new internal_server_error_1.InternalServerError("Failed to get the Documents");
        }
        res.render("pull", { fileDetails: fileDetails });
    }
});
