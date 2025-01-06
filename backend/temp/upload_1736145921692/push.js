"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentPush = void 0;
const axios_1 = __importDefault(require("axios"));
const xml2js_1 = require("xml2js");
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../shared/database"));
const common_1 = require("../shared/common");
const types_1 = require("../types/types");
const check_auth_1 = require("../middlewares/check-auth");
const internal_server_error_1 = require("../errors/internal-server-error");
const db_operations_1 = require("../shared/db-operations");
const check_access_user_1 = require("../middlewares/check-access-user");
const password_1 = require("../shared/password");
const logger_1 = require("../lib/logger");
const index_1 = require("../index");
const router = express_1.default.Router();
exports.DocumentPush = router;
router.post('/push', check_auth_1.checkAuth, check_access_user_1.checkAccessUser, async (req, res) => {
    logger_1.logger.info("PUSH VIEW:Connecting To Database");
    const mssql = await (0, database_1.default)();
    if (mssql) {
        logger_1.logger.info("PUSH VIEW:Connected To Database");
        const SiteList = req.query && req.query.sListId ? req.query.sListId.toString() : '';
        logger_1.logger.info("PUSH VIEW:Site Library ID: " + SiteList);
        const userSP = req.userSP;
        let user = req.user;
        const SPSite = req.body.SPSiteUrl;
        const spItemIds = req.query && req.query.sItemId ? req.query.sItemId.toString().split(',') : [];
        logger_1.logger.info("PUSH VIEW: Document IDs: " + JSON.stringify(spItemIds));
        const library = await userSP.web.lists.getById(SiteList).select("Title")();
        logger_1.logger.info("PUSH VIEW:Site Library: " + library.Title);
        let config;
        let instanceDetails;
        let project;
        let aconexAttributes;
        config = await (0, db_operations_1.getSiteProfileSetting)(mssql, SPSite, library.Title);
        logger_1.logger.info("PUSH VIEW: Aconex SP Configuration: " + JSON.stringify(config));
        //below
        instanceDetails = await (0, db_operations_1.getAconexInstanceDetails)(mssql, config.AconexInstanceURL, config.AconexInstanceName);
        logger_1.logger.info("PUSH VIEW: Aconex Instance Details: " + JSON.stringify(instanceDetails));
        //below
        project = await (0, db_operations_1.getAconexProjectDetails)(mssql, config.AconexInstanceURL, config.AconexProjectID, config.AconexInstanceName);
        logger_1.logger.info("PUSH VIEW: Aconex Project : " + JSON.stringify(project));
        aconexAttributes = await (0, db_operations_1.getAconexAttributes)(mssql);
        logger_1.logger.info("PUSH VIEW: Aconex Attributes : " + JSON.stringify(aconexAttributes));
        let fileDetails = [];
        let promiseArray = [];
        const mapping = JSON.parse(config.MetadataMapping);
        let keys = Object.keys(mapping);
        logger_1.logger.info("PUSH VIEW: Looping through documents");
        for (let spItemId of spItemIds) {
            var responsePromise = new Promise(async (resolve, reject) => {
                try {
                    const list = await userSP.web.lists.getByTitle(library.Title).items.getById(parseInt(spItemId)).select('File').expand("File").get();
                    const spFileInfo = list.File;
                    logger_1.logger.info("PUSH VIEW: File Name: " + spFileInfo.Name);
                    const metadata = await userSP.web.getFolderByServerRelativePath(spFileInfo.ServerRelativeUrl).listItemAllFields();
                    logger_1.logger.info("PUSH VIEW: " + spFileInfo.Name + " File Metadata: " + JSON.stringify(metadata));
                    const versionHistory = await userSP.web.lists.getByTitle(library.Title).items.getById(parseInt(spItemId)).select('Versions').expand('Versions').get();
                    let spversion = parseInt(versionHistory.Versions[0].VersionLabel);
                    logger_1.logger.info("PUSH VIEW: " + spFileInfo.Name + " SP Version No.: " + spversion);
                    let documentNo = '';
                    for (let k of keys) {
                        const attrindex = aconexAttributes.findIndex(a => a.CreateIdentifier === k);
                        if (attrindex > -1) {
                            let attributeValue = metadata[mapping[k]];
                            if (k === 'DocumentNumber') {
                                documentNo = attributeValue ? attributeValue.toString() : '';
                            }
                        }
                    }
                    logger_1.logger.info("PUSH VIEW: " + spFileInfo.Name + " Document No.: " + documentNo);
                    let action;
                    let ackversion;
                    let message = '';
                    if (documentNo != '') {
                        logger_1.logger.info("PUSH VIEW: " + spFileInfo.Name + " Searching file in Aconex ");
                        const fileSearch = await axios_1.default.get(`${instanceDetails.AconexURL}/api/projects/${config.AconexProjectID}/register?search_query=docno:${documentNo}&return_fields=versionnumber`, {
                            auth: {
                                username: instanceDetails.ServiceAccountName,
                                password: (0, password_1.decryptedPassword)(instanceDetails.Password)
                            }
                        });
                        const r = await (0, xml2js_1.parseStringPromise)(fileSearch.data);
                        if (r.RegisterSearch && r.RegisterSearch.SearchResults && r.RegisterSearch.$.TotalResults != '0' && r.RegisterSearch.SearchResults.length > 0 && r.RegisterSearch.SearchResults[0].Document[0]) {
                            logger_1.logger.info("PUSH VIEW: " + spFileInfo.Name + " File found in Aconex");
                            ackversion = r.RegisterSearch.SearchResults[0].Document[0].VersionNumber[0];
                            logger_1.logger.info("PUSH VIEW: " + spFileInfo.Name + " Aconex Version No.: " + ackversion);
                            if (spversion > parseInt(ackversion)) {
                                logger_1.logger.info("PUSH VIEW: " + spFileInfo.Name + " to be added a be version in Aconex.");
                                action = types_1.DocumentPushActions.VERSION;
                                message = types_1.Messages.VERSION;
                            }
                            else {
                                logger_1.logger.info("PUSH VIEW: " + spFileInfo.Name + " is already up to date in Aconex.");
                                action = types_1.DocumentPushActions.UPDATED;
                                message = types_1.Messages.UPDATED;
                            }
                        }
                        else {
                            logger_1.logger.info("PUSH VIEW: " + spFileInfo.Name + " File not found in Aconex, need to push the file in Aconex");
                            ackversion = "";
                            action = types_1.DocumentPushActions.CREATE;
                            message = types_1.Messages.CREATE;
                        }
                    }
                    else {
                        logger_1.logger.info("PUSH VIEW: " + spFileInfo.Name + " Document No is not available.");
                        action = types_1.DocumentPushActions.DOCNOREQUIRED;
                        message = types_1.Messages.DOCNOREQUIRED;
                    }
                    let viewDetails = { documentNo: documentNo, revision: metadata.Revision, spVersion: spversion, ackVersion: ackversion, documentName: spFileInfo.Name, action: action, instance: instanceDetails.InstanceName, projectName: project.ProjectName, project: config.AconexProjectID, site: config.SharepointSite, itemId: parseInt(spItemId), message: message, operation: types_1.OperationActions.PUSH, user: user.Title };
                    logger_1.logger.info("PUSH VIEW: " + spFileInfo.Name + " Data to view." + JSON.stringify(viewDetails));
                    resolve(viewDetails);
                }
                catch (err) {
                    logger_1.logger.error((0, index_1.line)("PUSH VIEW: Failed to get document details ID: " + spItemId + " with error: " + err.message));
                    reject(types_1.Messages.ERRORDOCFETCH);
                }
            });
            promiseArray.push(responsePromise);
        }
        try {
            fileDetails = await Promise.all(promiseArray);
        }
        catch (err) {
            logger_1.logger.error((0, index_1.line)("PUSH VIEW: Failed to get the Documents: " + err.message));
            throw new internal_server_error_1.InternalServerError(err);
        }
        res.render("push", { fileDetails: fileDetails });
    }
});
router.post("/aconex/create", check_auth_1.checkAuthFromCookie, check_access_user_1.checkAccessUser, async (req, res) => {
    logger_1.logger.info("PUSH TO ACONEX: Connecting To Database");
    const mssql = await (0, database_1.default)();
    if (mssql) {
        logger_1.logger.info("PUSH TO ACONEX: Connected To Database");
        const SiteList = req.cookies.SiteLibrary;
        logger_1.logger.info("PUSH TO ACONEX:Site Library ID: " + SiteList);
        const userSP = req.userSP;
        let user = req.user;
        const SPSite = req.cookies.SPSiteUrl;
        const library = await userSP.web.lists.getById(SiteList).select("Title")();
        logger_1.logger.info("PUSH TO ACONEX: Site Library: " + library.Title);
        let config;
        let instanceDetails;
        let project;
        let aconexAttributes;
        let attributesMapping;
        config = await (0, db_operations_1.getSiteProfileSetting)(mssql, SPSite, library.Title);
        logger_1.logger.info("PUSH TO ACONEX: Aconex SP Configuration: " + JSON.stringify(config));
        //below line
        instanceDetails = await (0, db_operations_1.getAconexInstanceDetails)(mssql, config.AconexInstanceURL, config.AconexInstanceName);
        logger_1.logger.info("PUSH TO ACONEX: Aconex Instance Details: " + JSON.stringify(instanceDetails));
        //below
        project = await (0, db_operations_1.getAconexProjectDetails)(mssql, config.AconexInstanceURL, config.AconexProjectID, config.AconexInstanceName);
        logger_1.logger.info("PUSH TO ACONEX: Aconex Project : " + JSON.stringify(project));
        aconexAttributes = await (0, db_operations_1.getAconexAttributes)(mssql);
        logger_1.logger.info("PUSH TO ACONEX: Aconex Project : " + JSON.stringify(aconexAttributes));
        attributesMapping = await (0, db_operations_1.getAconexAttributesMapping)(mssql, config.AconexProjectID);
        logger_1.logger.info("PUSH TO ACONEX: Aconex Attributes : " + JSON.stringify(attributesMapping));
        const mapping = JSON.parse(config.MetadataMapping);
        const spItemIds = req.body.spItemIds;
        let fileResponse = [];
        if (spItemIds.length > 0) {
            let syncObj;
            try {
                logger_1.logger.info("PUSH TO ACONEX: Looping through the documents ids");
                for (let i of spItemIds) {
                    logger_1.logger.info("PUSH TO ACONEX: Document: " + JSON.stringify(i));
                    if (i.action === types_1.DocumentPushActions.CREATE) {
                        logger_1.logger.info(i.item);
                        syncObj = await (0, common_1.createDocument)(i.item, userSP, user, config, instanceDetails, mssql, library, aconexAttributes, attributesMapping, mapping, project);
                        logger_1.logger.info("PUSH TO ACONEX: Create Document response: " + JSON.stringify(syncObj));
                        fileResponse.push(Object.assign(Object.assign({}, syncObj), { item: i.item }));
                    }
                    else {
                        syncObj = await (0, common_1.createVersion)(i.item, userSP, user, config, instanceDetails, mssql, library, aconexAttributes, attributesMapping, mapping, project);
                        logger_1.logger.info("PUSH TO ACONEX: Create Version push response: " + JSON.stringify(syncObj));
                        fileResponse.push(Object.assign(Object.assign({}, syncObj), { item: i.item }));
                    }
                }
            }
            catch (e) {
                logger_1.logger.error((0, index_1.line)("PUSH TO ACONEX: Error Occurred: " + e.message));
                throw new internal_server_error_1.InternalServerError(types_1.Messages.COMMON);
            }
        }
        res.send(fileResponse);
    }
});
