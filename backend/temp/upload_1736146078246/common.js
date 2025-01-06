"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pullDocument = exports.createVersion = exports.createDocument = void 0;
const axios_1 = __importDefault(require("axios"));
const types_1 = require("../types/types");
const xml2js_1 = require("xml2js");
const password_1 = require("./password");
const logger_1 = require("../lib/logger");
const index_1 = require("../index");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const escapeString = (str) => {
    if (typeof str === 'string') {
        if (str.length > 0) {
            return str.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        }
    }
    return str;
};
const checkDate = (dateStr) => {
    if (typeof dateStr === 'string') {
        if (dateStr.length > 0) {
            let dateArr = dateStr.split('T');
            let dateParse = dateArr[0];
            var dateReg = /^\d{4}[./-]\d{2}[./-]\d{2}$/;
            let match = dateParse.match(dateReg);
            return match;
        }
    }
    return false;
};
const createDocument = async (itemid, userSP, user, config, instanceDetails, mssql, library, aconexAttributes, attributesMapping, mapping, project) => {
    const date = Date.now();
    const trxno = "TRX-" + Date.now() + "-" + (Math.floor(Math.random() * (999 - 100 + 1) + 100));
    let spversion;
    let buffer;
    let spFileInfo;
    let metadata;
    let length;
    let documentNo = '';
    let revisionNo = '';
    let payload = "";
    let keys = Object.keys(mapping);
    let buffbase64;
    let headers = {
        "Content-Type": "multipart/mixed",
        "boundry": "registerdoc"
    };
    logger_1.logger.info("PUSH - Creating Document Begins");
    try {
        const list = await userSP.web.lists.getByTitle(library.Title).items.getById(itemid).select('File').expand("File").get();
        spFileInfo = list.File;
        logger_1.logger.info("PUSH - FileInfo : " + JSON.stringify(spFileInfo));
        logger_1.logger.info("PUSH - Creating Document in Aconex : " + spFileInfo.Name);
        metadata = await userSP.web.getFolderByServerRelativePath(spFileInfo.ServerRelativeUrl).listItemAllFields();
        logger_1.logger.info("PUSH Create: " + spFileInfo.Name + " File Metadata: " + JSON.stringify(metadata));
        const versionHistory = await userSP.web.lists.getByTitle(library.Title).items.getById(itemid).select('Versions').expand('Versions').get();
        spversion = parseInt(versionHistory.Versions[0].VersionLabel);
        logger_1.logger.info("PUSH Create: " + spFileInfo.Name + " SP Version No.: " + spversion);
        logger_1.logger.info("PUSH Create: " + spFileInfo.Name + " - Sending Request to download file from SP");
        buffer = await userSP.web.getFileByServerRelativePath(spFileInfo.ServerRelativeUrl).getBuffer();
        logger_1.logger.info("PUSH Create: " + spFileInfo.Name + " - File downloaded successfully from SP");
        length = buffer.byteLength;
        if (length / Math.pow(10, 6) > 100) {
            headers['Transfer-Encoding'] = 'chunked';
        }
        var buff = Buffer.from(new Uint8Array(buffer));
        buffbase64 = buff.toString('base64');
        var title = metadata["Title"] && metadata["Title"] != '' ? metadata["Title"] : spFileInfo.Name;
        title = escapeString(title);
        for (let k of keys) {
            const attrindex = aconexAttributes.findIndex(a => a.CreateIdentifier === k);
            if (attrindex > -1) {
                let attribute = aconexAttributes[attrindex];
                let attributeValue = metadata[mapping[k]];
                console.log(attribute.CreateIdentifier + " " + attributeValue);
                if (attributeValue != null && attributeValue != undefined) {
                    if (attribute.CreateIdentifier == "AccessList") {
                        let users = [];
                        // if(attributeValue===true){
                        // 	const projectUsers = await axios.get(
                        // 		`${instanceDetails.AconexURL}/api/projects/${config.AconexProjectID}/directory`,
                        // 		{
                        // 			auth: {
                        // 				username: instanceDetails.ServiceAccountName,
                        // 				password: decryptedPassword(instanceDetails.Password)
                        // 			}
                        // 		}
                        // 	)
                        // 	let u = projectUsers.data
                        // 	if(u.totalResultsCount > 0){
                        // 		for(let user of u.searchResults){
                        // 			users.push(user.userId)
                        // 		}
                        // 	}
                        // }
                        attributeValue = users;
                    }
                    if (checkDate(attributeValue)) {
                        attributeValue = new Date(Date.parse(attributeValue)).toISOString();
                    }
                    if (k === 'DocumentTypeId' || k === 'DocumentStatusId') {
                        const mappingIndex = attributesMapping.findIndex(m => m.StringValue === attributeValue);
                        if (mappingIndex > -1) {
                            attributeValue = attributesMapping[mappingIndex].IntegerValue;
                        }
                    }
                    if (k === 'DocumentNumber') {
                        documentNo = attributeValue.toString();
                    }
                    if (k === 'Revision') {
                        revisionNo = attributeValue.toString();
                    }
                    if (Array.isArray(attributeValue)) {
                        for (let i of attributeValue) {
                            payload += `<${attribute.CreateIdentifier}>${escapeString(i)}</${attribute.CreateIdentifier}>\n`;
                        }
                    }
                    else {
                        payload += `<${attribute.CreateIdentifier}>${escapeString(attributeValue)}</${attribute.CreateIdentifier}>\n`;
                    }
                }
            }
        }
        logger_1.logger.info("PUSH Create: " + spFileInfo.Name + " Document No.: " + documentNo);
        logger_1.logger.info("PUSH Create: " + spFileInfo.Name + " Revision: " + revisionNo);
        const transactionQuery = `INSERT INTO Transactions VALUES(
			'${trxno}',
			'${spFileInfo.Name}',
			'${documentNo}',
			'${spFileInfo.UniqueId}',
			'${types_1.OperationActions.PUSH}',
			'0',
			'${revisionNo}',
			'${spversion}',
			'${config.AconexProjectID}',
			'${project.ProjectName}',
			'${instanceDetails.InstanceName}',
			'${config.SharepointSite}',
			'${config.SharepointSiteLibrary}',
			GETDATE(),
			'${user.Title}',
			'${types_1.OperationStatus.PENDING}',
			''
		)`;
        logger_1.logger.info("PUSH Create: Transaction Query " + spFileInfo.Name + " - " + transactionQuery);
        logger_1.logger.info("PUSH Create: Saving the transaction");
        await mssql.query(transactionQuery);
        logger_1.logger.info("PUSH Create: Transaction saved successfully");
    }
    catch (e) {
        if (e.stack) {
            logger_1.logger.error((0, index_1.line)("PUSH Create Error:" + JSON.stringify(e.stack)));
        }
        logger_1.logger.error((0, index_1.line)("PUSH Create Error:" + e.message));
        return { sync: false, error: "Internal Server Error" };
    }
    try {
        if (process.env.CHECKIN_CHECKOUT == "TRUE") {
            logger_1.logger.info("CHECKING OUT THE DOCUMENT");
            const checkout = await userSP.web.getFileByServerRelativePath(spFileInfo.ServerRelativeUrl).checkout();
            logger_1.logger.info("DOCUMENT CHECKED OUT");
        }
        const acxdata = `\n--registerdoc\n\n<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Document>\n<Title>${title}</Title>\n<HasFile>true</HasFile>\n${payload}</Document>\n\n--registerdoc\n\nX-Filename: ${spFileInfo.Name}\n\n${buffbase64}\n\n--registerdoc--`;
        logger_1.logger.info("PUSH Create " + spFileInfo.Name + ": Sending request for creating file in Aconex. Payload " + acxdata);
        logger_1.logger.info("PUSH Create " + spFileInfo.Name + ": Request Headers - " + JSON.stringify(headers));
        const y = await axios_1.default.post(`${instanceDetails.AconexURL}/api/projects/${config.AconexProjectID}/register`, acxdata, {
            auth: {
                username: instanceDetails.ServiceAccountName,
                password: (0, password_1.decryptedPassword)(instanceDetails.Password)
            },
            headers: headers,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        const response = await (0, xml2js_1.parseStringPromise)(y.data);
        const success = response.RegisterDocumentResult.Success[0];
        let status = types_1.OperationStatus.PENDING;
        let error = '';
        if (success == 'true') {
            logger_1.logger.info("PUSH Create " + spFileInfo.Name + ": Document created successfully");
            status = types_1.OperationStatus.SUCCESSFULL;
        }
        else {
            logger_1.logger.info("PUSH Create " + spFileInfo.Name + ": Document failed to sync");
            status = types_1.OperationStatus.FAILED;
            error = "Document failed to sync from Aconex";
        }
        const updateData = [];
        if (Object.keys(metadata).includes("AconexVersion") && status === types_1.OperationStatus.SUCCESSFULL) {
            updateData.push({ FieldName: 'AconexVersion', FieldValue: '1' });
        }
        if (Object.keys(metadata).includes("Operation")) {
            updateData.push({ FieldName: 'Operation', FieldValue: types_1.OperationActions.PUSH });
        }
        if (Object.keys(metadata).includes("AconexSync")) {
            updateData.push({ FieldName: 'AconexSync', FieldValue: status === types_1.OperationStatus.SUCCESSFULL ? 'true' : 'false' });
        }
        logger_1.logger.info("PUSH Create " + spFileInfo.Name + ": Data to update in SP: " + JSON.stringify(updateData));
        logger_1.logger.info("PUSH Create " + spFileInfo.Name + ": Sending request to update metadata in SP.");
        await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).
            validateUpdateListItem(updateData, true);
        logger_1.logger.info("PUSH Create " + spFileInfo.Name + ": SP metadata updated successfully.");
        let updateQuery = `UPDATE Transactions SET
                                Status = '${status}',
                                Error = '${error}'
                                WHERE TransactionNumber = '${trxno}'    
                            `;
        logger_1.logger.info("PUSH Create " + spFileInfo.Name + ": Updating transaction. Query: " + updateQuery);
        await mssql.query(updateQuery);
        logger_1.logger.info("PUSH Create " + spFileInfo.Name + ": Transaction updated successfully ");
        return { sync: true, error: error };
    }
    catch (e) {
        if (e.stack) {
            logger_1.logger.error((0, index_1.line)("PUSH Create Error: " + spFileInfo.Name + " - " + JSON.stringify(e.stack)));
        }
        let error = e.message;
        if (e.response && e.response.data) {
            const errObj = await (0, xml2js_1.parseStringPromise)(e.response.data);
            error = errObj.Error.ErrorDescription[0];
        }
        logger_1.logger.error((0, index_1.line)("PUSH Create Error: " + spFileInfo.Name + " - " + error));
        const updateData = [];
        if (Object.keys(metadata).includes("Operation")) {
            updateData.push({ FieldName: 'Operation', FieldValue: types_1.OperationActions.PUSH });
        }
        if (Object.keys(metadata).includes("AconexSync")) {
            updateData.push({ FieldName: 'AconexSync', FieldValue: 'false' });
        }
        logger_1.logger.info("PUSH Create " + spFileInfo.Name + ": Data to update in SP: " + JSON.stringify(updateData));
        logger_1.logger.info("PUSH Create " + spFileInfo.Name + ": Sending request to update metadata in SP.");
        await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).
            validateUpdateListItem(updateData, true);
        logger_1.logger.info("PUSH Create " + spFileInfo.Name + ": SP metadata updated successfully.");
        const updateQuery = `UPDATE Transactions SET
                                Status = '${types_1.OperationStatus.FAILED}',
                                Error = '${error}'
                                WHERE TransactionNumber = '${trxno}'    
                            `;
        logger_1.logger.info("PUSH Create " + spFileInfo.Name + ": Updating transaction. Query: " + updateQuery);
        await mssql.query(updateQuery);
        logger_1.logger.info("PUSH Create " + spFileInfo.Name + ": Transaction updated successfully ");
        return { sync: false, error: error };
    }
};
exports.createDocument = createDocument;
const createVersion = async (itemid, userSP, user, config, instanceDetails, mssql, library, aconexAttributes, attributesMapping, mapping, project) => {
    let spFileInfo;
    let payload = "";
    let headers;
    let documentNo = '';
    let revisionNo = '';
    const trxno = "TRX-" + Date.now() + "-" + (Math.floor(Math.random() * (999 - 100 + 1) + 100));
    let metadata;
    let buffbase64;
    logger_1.logger.info("PUSH - Versioning Document Begins");
    try {
        const list = await userSP.web.lists.getByTitle(library.Title).items.getById(itemid).select('File').expand("File").get();
        spFileInfo = list.File;
        logger_1.logger.info("PUSH - FileInfo : " + JSON.stringify(spFileInfo));
        logger_1.logger.info("PUSH - Versioning Document in Aconex : " + spFileInfo.Name);
        metadata = await userSP.web.getFolderByServerRelativePath(spFileInfo.ServerRelativeUrl).listItemAllFields();
        logger_1.logger.info("PUSH Version: " + spFileInfo.Name + " File Metadata: " + JSON.stringify(metadata));
        const versionHistory = await userSP.web.lists.getByTitle(library.Title).items.getById(itemid).select('Versions').expand('Versions').get();
        const spversion = parseInt(versionHistory.Versions[0].VersionLabel);
        logger_1.logger.info("PUSH Version: " + spFileInfo.Name + " SP Version No.: " + spversion);
        logger_1.logger.info("PUSH Version: " + spFileInfo.Name + " - Sending Request to download file from SP");
        const buffer = await userSP.web.getFileByServerRelativePath(spFileInfo.ServerRelativeUrl).getBuffer();
        logger_1.logger.info("PUSH Version: " + spFileInfo.Name + " - File downloaded successfully from SP");
        const length = buffer.byteLength;
        headers = {
            "Content-Type": "multipart/mixed",
            "boundry": "registerdoc"
        };
        if (length / Math.pow(10, 6) > 100) {
            headers['Transfer-Encoding'] = 'chunked';
        }
        var buff = Buffer.from(new Uint8Array(buffer));
        buffbase64 = buff.toString('base64');
        var title = metadata["Title"] && metadata["Title"] != '' ? metadata["Title"] : spFileInfo.Name;
        title = escapeString(title);
        let keys = Object.keys(mapping);
        for (let k of keys) {
            const attrindex = aconexAttributes.findIndex(a => a.CreateIdentifier === k);
            if (attrindex > -1) {
                let attribute = aconexAttributes[attrindex];
                let attributeValue = metadata[mapping[k]];
                if (attributeValue != null && attributeValue != undefined) {
                    if (k !== 'DocumentNumber') {
                        if (attribute.CreateIdentifier == "AccessList") {
                            let users = [];
                            // if(attributeValue===true){
                            // 	const projectUsers = await axios.get(
                            // 		`${instanceDetails.AconexURL}/api/projects/${config.AconexProjectID}/directory`,
                            // 		{
                            // 			auth: {
                            // 				username: instanceDetails.ServiceAccountName,
                            // 				password: decryptedPassword(instanceDetails.Password)
                            // 			}
                            // 		}
                            // 	)
                            // 	let u = projectUsers.data
                            // 	if(u.totalResultsCount > 0){
                            // 		for(let user of u.searchResults){
                            // 			users.push(user.userId)
                            // 		}
                            // 	}
                            // }
                            attributeValue = users;
                        }
                        if (checkDate(attributeValue)) {
                            attributeValue = new Date(Date.parse(attributeValue)).toISOString();
                        }
                        if (k === 'DocumentTypeId' || k === 'DocumentStatusId') {
                            const mappingIndex = attributesMapping.findIndex(m => m.StringValue === attributeValue);
                            if (mappingIndex > -1) {
                                attributeValue = attributesMapping[mappingIndex].IntegerValue;
                            }
                        }
                        if (Array.isArray(attributeValue)) {
                            for (let i of attributeValue) {
                                payload += `<${attribute.CreateIdentifier}>${escapeString(i)}</${attribute.CreateIdentifier}>\n`;
                            }
                        }
                        else {
                            payload += `<${attribute.CreateIdentifier}>${escapeString(attributeValue)}</${attribute.CreateIdentifier}>\n`;
                        }
                    }
                    if (k === 'DocumentNumber') {
                        documentNo = attributeValue.toString();
                    }
                    if (k === 'Revision') {
                        revisionNo = attributeValue.toString();
                    }
                }
            }
        }
        logger_1.logger.info("PUSH Version: " + spFileInfo.Name + " Document No.: " + documentNo);
        logger_1.logger.info("PUSH Version: " + spFileInfo.Name + " Revision: " + revisionNo);
        const transactionQuery = `INSERT INTO Transactions VALUES(
			'${trxno}',
			'${spFileInfo.Name}',
			'${documentNo}',
			'${spFileInfo.UniqueId}',
			'${types_1.OperationActions.PUSH}',
			'0',
			'${revisionNo}',
			'${spversion}',
			'${config.AconexProjectID}',
			'${project.ProjectName}',
			'${instanceDetails.InstanceName}',
			'${config.SharepointSite}',
			'${config.SharepointSiteLibrary}',
			GETDATE(),
			'${user.Title}',
			'${types_1.OperationStatus.PENDING}',
			''
		)`;
        logger_1.logger.info("PUSH Version: Transaction Query " + spFileInfo.Name + " - " + transactionQuery);
        logger_1.logger.info("PUSH Version: Saving the transaction");
        await mssql.query(transactionQuery);
        logger_1.logger.info("PUSH Version: Transaction saved successfully");
    }
    catch (e) {
        if (e.stack) {
            logger_1.logger.error((0, index_1.line)("PUSH Version Error:" + JSON.stringify(e.stack)));
        }
        logger_1.logger.error((0, index_1.line)("PUSH Version Error:" + e.message));
        return { sync: false, error: "Internal Server Error" };
    }
    let acxdata = `\n--registerdoc\n\n<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Document>\n<Title>${title}</Title>\n<HasFile>true</HasFile>\n${payload}</Document>\n\n--registerdoc\n\nX-Filename: ${spFileInfo.Name}\n\n${buffbase64}\n\n--registerdoc--`;
    logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Sending request to get latest version of document from Aconex");
    const c = await axios_1.default.get(`${instanceDetails.AconexURL}/api/projects/${config.AconexProjectID}/register?search_query=docno:${documentNo}&return_fields=versionnumber`, {
        auth: {
            username: instanceDetails.ServiceAccountName,
            password: (0, password_1.decryptedPassword)(instanceDetails.Password)
        }
    });
    const r = await (0, xml2js_1.parseStringPromise)(c.data);
    if (r.RegisterSearch && r.RegisterSearch.SearchResults && parseInt(r.RegisterSearch.$.TotalResults) > 0 && r.RegisterSearch.SearchResults[0].Document[0]) {
        logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": File exists in Aconex");
        const docId = r.RegisterSearch.SearchResults[0].Document[0]['$'].DocumentId;
        let ackversion = r.RegisterSearch.SearchResults[0].Document[0].VersionNumber[0];
        logger_1.logger.info("PUSH Version: " + spFileInfo.Name + " Aconex Document ID.: " + docId);
        logger_1.logger.info("PUSH Version: " + spFileInfo.Name + " Aconex Version No.: " + ackversion);
        try {
            if (process.env.CHECKIN_CHECKOUT == "TRUE") {
                logger_1.logger.info("CHECKING OUT THE DOCUMENT");
                const checkout = await userSP.web.getFileByServerRelativePath(spFileInfo.ServerRelativeUrl).checkout();
                logger_1.logger.info("DOCUMENT CHECKED OUT");
            }
            logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Sending request for creating file in Aconex. Payload " + acxdata);
            logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Request Headers - " + JSON.stringify(headers));
            const y = await axios_1.default.post(`${instanceDetails.AconexURL}/api/projects/${config.AconexProjectID}/register/${docId}/supersede`, acxdata, {
                auth: {
                    username: instanceDetails.ServiceAccountName,
                    password: (0, password_1.decryptedPassword)(instanceDetails.Password)
                },
                headers: headers,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            const response = await (0, xml2js_1.parseStringPromise)(y.data);
            const success = response.RegisterDocumentResult.Success[0];
            const newDocId = response.RegisterDocumentResult.RegisterDocument[0];
            if (success === 'true') {
                logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Document created successfully");
                const updateData = [];
                if (Object.keys(metadata).includes("AconexVersion")) {
                    updateData.push({ FieldName: 'AconexVersion', FieldValue: (parseInt(ackversion) + 1).toString() });
                }
                if (Object.keys(metadata).includes("Operation")) {
                    updateData.push({ FieldName: 'Operation', FieldValue: types_1.OperationActions.PUSH });
                }
                if (Object.keys(metadata).includes("AconexSync")) {
                    updateData.push({ FieldName: 'AconexSync', FieldValue: 'true' });
                }
                logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Data to update in SP: " + JSON.stringify(updateData));
                logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Sending request to update metadata in SP.");
                await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).
                    validateUpdateListItem(updateData, true);
                logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": SP metadata updated successfully.");
                const updateQuery = `UPDATE Transactions SET
                                Status = '${types_1.OperationStatus.SUCCESSFULL}',
                                Error = '',
                                AconexDocVersionNo = '${ackversion}'
                                WHERE TransactionNumber = '${trxno}'    
                            `;
                logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Updating transaction. Query: " + updateQuery);
                await mssql.query(updateQuery);
                logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Transaction updated successfully ");
                return { sync: true, error: '' };
            }
            else {
                const updateData = [];
                if (Object.keys(metadata).includes("Operation")) {
                    updateData.push({ FieldName: 'Operation', FieldValue: types_1.OperationActions.PUSH });
                }
                if (Object.keys(metadata).includes("AconexSync")) {
                    updateData.push({ FieldName: 'AconexSync', FieldValue: 'false' });
                }
                logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Data to update in SP: " + JSON.stringify(updateData));
                logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Sending request to update metadata in SP.");
                await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).
                    validateUpdateListItem(updateData, true);
                logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": SP metadata updated successfully.");
                const updateQuery = `UPDATE Transactions SET
                                Status = '${types_1.OperationStatus.FAILED}',
                                Error = 'Document failed to sync from Aconex',
                                AconexDocVersionNo = '${ackversion}'
                                WHERE TransactionNumber = '${trxno}'    
                            `;
                logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Updating transaction. Query: " + updateQuery);
                await mssql.query(updateQuery);
                logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Transaction updated successfully ");
                return { sync: false, error: 'Document failed to sync from Aconex' };
            }
        }
        catch (e) {
            if (e.stack) {
                logger_1.logger.error((0, index_1.line)("PUSH Version Error: " + spFileInfo.Name + " - " + JSON.stringify(e.stack)));
            }
            let error = e.message;
            if (e.response && e.response.data) {
                const errObj = await (0, xml2js_1.parseStringPromise)(e.response.data);
                logger_1.logger.error((0, index_1.line)(errObj.Error.ErrorDescription));
                error = errObj.Error.ErrorDescription[0];
            }
            logger_1.logger.error((0, index_1.line)("PUSH Version Error: " + spFileInfo.Name + " - " + error));
            const updateData = [];
            if (Object.keys(metadata).includes("Operation")) {
                updateData.push({ FieldName: 'Operation', FieldValue: types_1.OperationActions.PUSH });
            }
            if (Object.keys(metadata).includes("AconexSync")) {
                updateData.push({ FieldName: 'AconexSync', FieldValue: 'false' });
            }
            logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Data to update in SP: " + JSON.stringify(updateData));
            logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Sending request to update metadata in SP.");
            await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).
                validateUpdateListItem(updateData, true);
            logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": SP metadata updated successfully.");
            const updateQuery = `UPDATE Transactions SET
                                Status = '${types_1.OperationStatus.FAILED}',
                                Error = '${error}',
                                AconexDocVersionNo = '${ackversion}'
                                WHERE TransactionNumber = '${trxno}'    
                            `;
            logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Updating transaction. Query: " + updateQuery);
            await mssql.query(updateQuery);
            logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Transaction updated successfully ");
            return { sync: false, error: error };
        }
    }
    else {
        const updateData = [];
        if (Object.keys(metadata).includes("Operation")) {
            updateData.push({ FieldName: 'Operation', FieldValue: types_1.OperationActions.PUSH });
        }
        if (Object.keys(metadata).includes("AconexSync")) {
            updateData.push({ FieldName: 'AconexSync', FieldValue: 'false' });
        }
        logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Data to update in SP: " + JSON.stringify(updateData));
        logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Sending request to update metadata in SP.");
        await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).
            validateUpdateListItem(updateData, true);
        logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": SP metadata updated successfully.");
        const updateQuery = `UPDATE Transactions SET
                                Status = '${types_1.OperationStatus.FAILED}',
                                Error = 'Document not found in Aconex',
                                WHERE TransactionNumber = '${trxno}'    
                            `;
        logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Updating transaction. Query: " + updateQuery);
        await mssql.query(updateQuery);
        logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Transaction updated successfully ");
        return { sync: false, error: 'Document not found in Aconex' };
    }
};
exports.createVersion = createVersion;
const pullDocument = async (itemid, docNo, userSP, user, config, instanceDetails, mssql, library, aconexAttributes, mapping, project) => {
    const trxno = "TRX-" + Date.now() + "-" + (Math.floor(Math.random() * (999 - 100 + 1) + 100));
    let documentNo = '';
    let revisionNo = '';
    let spFileInfo;
    let metadata;
    logger_1.logger.info("PULL - Pulling Document Begins");
    try {
        const list = await userSP.web.lists.getByTitle(library.Title).items.getById(itemid).select('File').expand("File").get();
        spFileInfo = list.File;
        logger_1.logger.info("PULL - FileInfo : " + JSON.stringify(spFileInfo));
        logger_1.logger.info("PULL - Creating Document in Aconex : " + spFileInfo.Name);
        metadata = await userSP.web.getFolderByServerRelativePath(spFileInfo.ServerRelativeUrl).listItemAllFields();
        logger_1.logger.info("PULL Create: " + spFileInfo.Name + " File Metadata: " + JSON.stringify(metadata));
        const versionHistory = await userSP.web.lists.getByTitle(library.Title).items.getById(itemid).select('Versions').expand('Versions').get();
        const spversion = parseInt(versionHistory.Versions[0].VersionLabel);
        logger_1.logger.info("PULL Create: " + spFileInfo.Name + " SP Version No.: " + spversion);
        let keys = Object.keys(mapping);
        for (let k of keys) {
            const attrindex = aconexAttributes.findIndex(a => a.CreateIdentifier === k);
            if (attrindex > -1) {
                let attributeValue = metadata[mapping[k]];
                if (k === 'DocumentNumber') {
                    documentNo = attributeValue.toString();
                }
                if (k === 'Revision') {
                    revisionNo = attributeValue.toString();
                }
            }
        }
        logger_1.logger.info("PULL Create: " + spFileInfo.Name + " Document No.: " + documentNo);
        logger_1.logger.info("PULL Create: " + spFileInfo.Name + " Revision: " + revisionNo);
        const transactionQuery = `INSERT INTO Transactions VALUES(
			'${trxno}',
			'${spFileInfo.Name}',
			'${documentNo}',
			'${spFileInfo.UniqueId}',
			'${types_1.OperationActions.PULL}',
			'0',
			'${revisionNo}',
			'${spversion}',
			'${config.AconexProjectID}',
			'${project.ProjectName}',
			'${instanceDetails.InstanceName}',
			'${config.SharepointSite}',
			'${config.SharepointSiteLibrary}',
			GETDATE(),
			'${user.Title}',
			'${types_1.OperationStatus.PENDING}',
			''
		)`;
        logger_1.logger.info("PULL Create: Transaction Query " + spFileInfo.Name + " - " + transactionQuery);
        logger_1.logger.info("PULL Create: Saving the transaction");
        await mssql.query(transactionQuery);
        logger_1.logger.info("PULL Create: Transaction saved successfully");
    }
    catch (e) {
        if (e.stack) {
            logger_1.logger.error((0, index_1.line)("PULL Create Error:" + JSON.stringify(e.stack)));
        }
        logger_1.logger.error((0, index_1.line)("PULL Create Error:" + e.message));
        return { sync: false, error: "Internal Server Error from DB" };
    }
    try {
        if (process.env.CHECKIN_CHECKOUT == "TRUE") {
            logger_1.logger.info("CHECKING OUT THE DOCUMENT");
            const checkout = await userSP.web.getFileByServerRelativePath(spFileInfo.ServerRelativeUrl).checkout();
            logger_1.logger.info("DOCUMENT CHECKED OUT");
        }
        logger_1.logger.info("PULL Version " + spFileInfo.Name + ": Sending request to get latest version of document from Aconex");
        const fileSearch = await axios_1.default.get(`${instanceDetails.AconexURL}/api/projects/${config.AconexProjectID}/register?search_query=docno:${documentNo}&return_fields=versionnumber`, {
            auth: {
                username: instanceDetails.ServiceAccountName,
                password: (0, password_1.decryptedPassword)(instanceDetails.Password)
            }
        });
        const r = await (0, xml2js_1.parseStringPromise)(fileSearch.data);
        if (r.RegisterSearch && r.RegisterSearch.SearchResults && r.RegisterSearch.SearchResults.length > 0 && r.RegisterSearch.SearchResults[0].Document[0]) {
            logger_1.logger.info("PULL Version " + spFileInfo.Name + ": File exists in Aconex");
            const docId = r.RegisterSearch.SearchResults[0].Document[0]['$'].DocumentId;
            let ackversion = r.RegisterSearch.SearchResults[0].Document[0].VersionNumber[0];
            logger_1.logger.info("PULL Version: " + spFileInfo.Name + " Aconex Document ID.: " + docId);
            logger_1.logger.info("PULL Version: " + spFileInfo.Name + " Aconex Version No.: " + ackversion);
            logger_1.logger.info("PULL Version: " + spFileInfo.Name + "- Sending request for getting document metadata.");
            const acxmetadataReq = await axios_1.default.get(`${instanceDetails.AconexURL}/api/projects/${config.AconexProjectID}/register/${docId}/metadata`, {
                auth: {
                    username: instanceDetails.ServiceAccountName,
                    password: (0, password_1.decryptedPassword)(instanceDetails.Password)
                }
            });
            const acxmetadata = await (0, xml2js_1.parseStringPromise)(acxmetadataReq.data);
            const acxmeta = acxmetadata.RegisterDocument;
            logger_1.logger.info("PULL Version: " + spFileInfo.Name + "- Aconex Document metadata :" + JSON.stringify(acxmeta));
            logger_1.logger.info("PULL Version: " + spFileInfo.Name + "- Sending request for updating document in SP.");
            const newFilename = acxmeta["Filename"] ? acxmeta["Filename"].toString() : spFileInfo.Name;
            logger_1.logger.info("PULL Version: New File Name " + newFilename);
            logger_1.logger.info("PULL Version: " + spFileInfo.Name + "- Sending request to download file.");
            const index = spFileInfo.ServerRelativeUrl.lastIndexOf("/");
            const serverPath = spFileInfo.ServerRelativeUrl.substr(0, index);
            const aconexFile = await axios_1.default.get(`${instanceDetails.AconexURL}/api/projects/${config.AconexProjectID}/register/${docId}/markedup?sizeForceFetch=true`, {
                auth: {
                    username: instanceDetails.ServiceAccountName,
                    password: (0, password_1.decryptedPassword)(instanceDetails.Password)
                },
                responseType: "arraybuffer"
            });
            logger_1.logger.info("PULL Version: " + spFileInfo.Name + "- File downloaded successfully from Aconex");
            await userSP.web.getFolderByServerRelativePath(serverPath).files.addChunked(spFileInfo.Name, aconexFile.data, undefined, true);
            let updateData = [];
            const mapping = JSON.parse(config.MetadataMapping);
            let keys = Object.keys(mapping);
            function getTimezone(url) {
                return timezoneMap.get(url) || 'UTC';
            }
            function convertDateToTimezone(dateString, timezone) {
                return new Date(dateString).toLocaleString('en-US', { timeZone: timezone });
            }
            const acxurl = instanceDetails.AconexURL;
            const timezones = JSON.parse(process.env.TIMEZONES);
            const aconexsites = Object.keys(timezones);
            const timezoneMap = new Map();
            aconexsites.forEach((url) => {
                if (timezones[url]) {
                    timezoneMap.set(url, timezones[url]);
                }
                else {
                    timezoneMap.set(url, 'UTC');
                }
            });
            const timezone = getTimezone(acxurl);
            updateData.push({ FieldName: 'FileLeafRef', FieldValue: newFilename });
            if (Object.keys(metadata).includes("AconexVersion")) {
                updateData.push({ FieldName: 'AconexVersion', FieldValue: ackversion.toString() });
            }
            if (Object.keys(metadata).includes("Operation")) {
                updateData.push({ FieldName: 'Operation', FieldValue: types_1.OperationActions.PULL });
            }
            if (Object.keys(metadata).includes("AconexSync")) {
                updateData.push({ FieldName: 'AconexSync', FieldValue: 'true' });
            }
            for (let k of keys) {
                const attrindex = aconexAttributes.findIndex(a => a.CreateIdentifier === k);
                if (attrindex > -1) {
                    if (acxmeta[aconexAttributes[attrindex].MetadataIdentifier] != null && acxmeta[aconexAttributes[attrindex].MetadataIdentifier] != undefined) {
                        let metadataValue = acxmeta[aconexAttributes[attrindex].MetadataIdentifier];
                        if (metadataValue.length > 1) {
                            metadataValue = metadataValue.join(";#");
                        }
                        else if (checkDate(metadataValue[0])) {
                            // let mataDataDate = new Date(Date.parse(metadataValue[0]));
                            const convertedDate = convertDateToTimezone(metadataValue[0], timezone);
                            // logger.info(metadataValue[0] + " in UTC || Timezone to convert : " + timezone)
                            // logger.info(convertedDate);
                            let mataDataDate = new Date(convertedDate);
                            // logger.info(mataDataDate)
                            metadataValue = (mataDataDate.getMonth() + 1) + '/' + mataDataDate.getDate() + '/' + mataDataDate.getFullYear();
                            //metadataValue = mataDataDate.getFullYear()+'-'+(mataDataDate.getMonth() + 1)+'-'+mataDataDate.getDate() // For SNCL
                            // logger.info(metadataValue);
                        }
                        else if (metadataValue[0]["AttributeTypeNames"]) {
                            if (metadataValue[0]["AttributeTypeNames"][0] && metadataValue[0]["AttributeTypeNames"][0]["AttributeTypeName"] && metadataValue[0]["AttributeTypeNames"][0]["AttributeTypeName"].length > 0) {
                                metadataValue = metadataValue[0]["AttributeTypeNames"][0]["AttributeTypeName"].join(";#");
                            }
                            else {
                                metadataValue = "";
                            }
                        }
                        else {
                            metadataValue = metadataValue[0];
                        }
                        updateData.push({ FieldName: mapping[k], FieldValue: metadataValue });
                    }
                }
            }
            logger_1.logger.info("PULL Version " + spFileInfo.Name + ": Data to update in SP: " + JSON.stringify(updateData));
            logger_1.logger.info("PULL Version " + spFileInfo.Name + ": Sending request to update metadata in SP.");
            let updatemetadata = await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).validateUpdateListItem(updateData, true);
            logger_1.logger.info("PULL Version " + spFileInfo.Name + ": SP metadata updated successfully." + JSON.stringify(updatemetadata));
            if (updatemetadata.length > 0) {
                for (let m of updatemetadata) {
                    if (m.HasException) {
                        let errormsg = m.ErrorMessage + ' for field ' + m.FieldName;
                        throw new Error(errormsg);
                    }
                }
            }
            const updateQuery = `UPDATE Transactions SET
                                Status = '${types_1.OperationStatus.SUCCESSFULL}',
                                Error = '',
                                AconexDocVersionNo = '${ackversion}'
                                WHERE TransactionNumber = '${trxno}'    
                            `;
            logger_1.logger.info("PULL Version " + spFileInfo.Name + ": Updating transaction. Query: " + updateQuery);
            await mssql.query(updateQuery);
            logger_1.logger.info("PUSH Version " + spFileInfo.Name + ": Transaction updated successfully ");
            return { sync: true, error: '' };
        }
        else {
            const updateData = [];
            if (Object.keys(metadata).includes("Operation")) {
                updateData.push({ FieldName: 'Operation', FieldValue: types_1.OperationActions.PULL });
            }
            if (Object.keys(metadata).includes("AconexSync")) {
                updateData.push({ FieldName: 'AconexSync', FieldValue: 'false' });
            }
            logger_1.logger.info("PULL Version " + spFileInfo.Name + ": Data to update in SP: " + JSON.stringify(updateData));
            logger_1.logger.info("PULL Version " + spFileInfo.Name + ": Sending request to update metadata in SP.");
            await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).
                validateUpdateListItem(updateData, true);
            logger_1.logger.info("PULL Version " + spFileInfo.Name + ": SP metadata updated successfully.");
            const updateQuery = `UPDATE Transactions SET
                                Status = '${types_1.OperationStatus.FAILED}',
                                Error = 'Document not availabe in Aconex'
                                WHERE TransactionNumber = '${trxno}'    
                            `;
            logger_1.logger.info("PULL Version " + spFileInfo.Name + ": Updating transaction. Query: " + updateQuery);
            await mssql.query(updateQuery);
            logger_1.logger.info("PULL Version " + spFileInfo.Name + ": Transaction updated successfully ");
            return { sync: false, error: "Document not available in Aconex" };
        }
    }
    catch (e) {
        if (e.stack) {
            logger_1.logger.error((0, index_1.line)("PULL Version Error: " + spFileInfo.Name + " - " + JSON.stringify(e.stack)));
        }
        let error = e.message;
        if (e.response && e.response.data) {
            const errObj = await (0, xml2js_1.parseStringPromise)(e.response.data);
            logger_1.logger.error((0, index_1.line)(errObj.Error.ErrorDescription));
            error = errObj.Error.ErrorDescription[0];
        }
        logger_1.logger.error((0, index_1.line)("PULL Version Error: " + spFileInfo.Name + " - " + error));
        const updateData = [];
        if (Object.keys(metadata).includes("Operation")) {
            updateData.push({ FieldName: 'Operation', FieldValue: types_1.OperationActions.PULL });
        }
        if (Object.keys(metadata).includes("AconexSync")) {
            updateData.push({ FieldName: 'AconexSync', FieldValue: 'false' });
        }
        logger_1.logger.info("PULL Version " + spFileInfo.Name + ": Data to update in SP: " + JSON.stringify(updateData));
        logger_1.logger.info("PULL Version " + spFileInfo.Name + ": Sending request to update metadata in SP.");
        await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).
            validateUpdateListItem(updateData, true);
        logger_1.logger.info("PULL Version " + spFileInfo.Name + ": SP metadata updated successfully.");
        const updateQuery = `UPDATE Transactions SET
                                Status = '${types_1.OperationStatus.FAILED}',
                                Error = '${error}'
                                WHERE TransactionNumber = '${trxno}'    
                            `;
        logger_1.logger.info("PULL Version " + spFileInfo.Name + ": Updating transaction. Query: " + updateQuery);
        await mssql.query(updateQuery);
        logger_1.logger.info("PULL Version " + spFileInfo.Name + ": Transaction updated successfully ");
        return { sync: false, error: error };
    }
};
exports.pullDocument = pullDocument;
