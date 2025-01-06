import { CheckinType, IFileInfo, IListInfo, SPRest } from "@pnp/sp-commonjs";
import { ISiteUserInfo } from "@pnp/sp-commonjs/site-users/types";
import axios from "axios";
import { ConnectionPool } from "mssql";
import { AconexAttributes, AconexInstanceCredentials, AconexProject, AttributesMapping, MetadataMapping, OperationActions, OperationResponse, OperationStatus, SiteProfileSetting } from "../types/types";
import { parseStringPromise } from "xml2js";
import { decryptedPassword } from "./password";
import { logger } from "../lib/logger";
import { line } from "../index";
import * as dotenv from 'dotenv';


dotenv.config();

const escapeString = (str: any) => {
	if(typeof str === 'string'){
		if(str.length > 0){
			return str.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&apos;');
		}
	}
	return str;
}

const checkDate = (dateStr: string) => {
	if(typeof dateStr === 'string'){
		if(dateStr.length > 0){
			let dateArr = dateStr.split('T')
			let dateParse = dateArr[0];
			var dateReg = /^\d{4}[./-]\d{2}[./-]\d{2}$/
			let match = dateParse.match(dateReg)
			return match
		}
	}
	return false
}

const createDocument = async (itemid: number,userSP: SPRest,user: ISiteUserInfo,config: SiteProfileSetting,instanceDetails: AconexInstanceCredentials,mssql: ConnectionPool, library: IListInfo,aconexAttributes: AconexAttributes[],attributesMapping: AttributesMapping[],mapping: MetadataMapping, project: AconexProject) : Promise<OperationResponse>=> {
	const date = Date.now();
	const trxno = "TRX-" + Date.now()+"-"+(Math.floor(Math.random()*(999-100+1)+100));
	let spversion: number
	let buffer: any
	let spFileInfo: IFileInfo
	let metadata: any
	let length
	let documentNo: string = ''
    let revisionNo: string = ''
	let payload = ""; 
	let keys = Object.keys(mapping)
	let buffbase64: any
	let headers: any = {
		"Content-Type": "multipart/mixed",
		"boundry": "registerdoc"
	}
	logger.info("PUSH - Creating Document Begins")
	try{
		const list = await userSP.web.lists.getByTitle(library.Title).items.getById(itemid).select('File').expand("File").get();
		spFileInfo = list.File;
			
		logger.info("PUSH - FileInfo : "+ JSON.stringify(spFileInfo))
		logger.info("PUSH - Creating Document in Aconex : "+ spFileInfo.Name)
		metadata = await userSP.web.getFolderByServerRelativePath(spFileInfo.ServerRelativeUrl).listItemAllFields();
		logger.info("PUSH Create: "+spFileInfo.Name+" File Metadata: "+ JSON.stringify(metadata))
		const versionHistory = await userSP.web.lists.getByTitle(library.Title).items.getById(itemid).select('Versions').expand('Versions').get();
		spversion = parseInt(versionHistory.Versions[0].VersionLabel);
		logger.info("PUSH Create: "+spFileInfo.Name+" SP Version No.: "+ spversion)
		logger.info("PUSH Create: "+spFileInfo.Name+" - Sending Request to download file from SP")
		buffer = await userSP.web.getFileByServerRelativePath(spFileInfo.ServerRelativeUrl).getBuffer();
		logger.info("PUSH Create: "+spFileInfo.Name+" - File downloaded successfully from SP")
		length = buffer.byteLength
		
		if(length/Math.pow(10,6) > 100){
			headers['Transfer-Encoding'] ='chunked' 
		}
		var buff = Buffer.from(new Uint8Array(buffer));
		buffbase64 = buff.toString('base64');
		var title = metadata["Title"] && metadata["Title"]!='' ?metadata["Title"]:spFileInfo.Name;
		title = escapeString(title)
		for(let k of keys){
			const attrindex =  aconexAttributes.findIndex(a => a.CreateIdentifier===k)
			if(attrindex > -1){
				let attribute = aconexAttributes[attrindex];
				let attributeValue = metadata[mapping[k]];
				console.log(attribute.CreateIdentifier+" "+attributeValue)
				if(attributeValue!=null && attributeValue!=undefined){
					if(attribute.CreateIdentifier=="AccessList"){
						let users: any = []
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
						attributeValue = users
					}
					if(checkDate(attributeValue as string)){
						attributeValue = new Date(Date.parse(attributeValue as string)).toISOString()
					}
					if(k==='DocumentTypeId' || k==='DocumentStatusId'){
						const mappingIndex = attributesMapping.findIndex(m => m.StringValue===attributeValue)
						if(mappingIndex > -1){
							attributeValue = attributesMapping[mappingIndex].IntegerValue
						}
					}
					if(k === 'DocumentNumber'){
						documentNo = attributeValue.toString()
					}
					if(k === 'Revision'){
						revisionNo = attributeValue.toString()
					}
					if(Array.isArray(attributeValue)){
						for(let i of attributeValue){
							payload += `<${attribute.CreateIdentifier}>${escapeString(i)}</${attribute.CreateIdentifier}>\n`
						}
					}else{
						payload += `<${attribute.CreateIdentifier}>${escapeString(attributeValue)}</${attribute.CreateIdentifier}>\n`
					}
				}
			}
		}
		logger.info("PUSH Create: "+spFileInfo.Name+" Document No.: "+ documentNo)
		logger.info("PUSH Create: "+spFileInfo.Name+" Revision: "+ revisionNo)
		const transactionQuery = `INSERT INTO Transactions VALUES(
			'${trxno}',
			'${spFileInfo.Name}',
			'${documentNo}',
			'${spFileInfo.UniqueId}',
			'${OperationActions.PUSH}',
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
			'${OperationStatus.PENDING}',
			''
		)`
		logger.info("PUSH Create: Transaction Query "+spFileInfo.Name+" - "+ transactionQuery)
		logger.info("PUSH Create: Saving the transaction")
		await mssql.query(transactionQuery)
		logger.info("PUSH Create: Transaction saved successfully")
	}catch(e: any){
		if(e.stack){
			logger.error(line("PUSH Create Error:"+ JSON.stringify(e.stack)))
		}
		logger.error(line("PUSH Create Error:"+ e.message))
		return {sync: false, error: "Internal Server Error"} as OperationResponse
	}
	
	try{
		if(process.env.CHECKIN_CHECKOUT == "TRUE")
		{
			logger.info("CHECKING OUT THE DOCUMENT")
			const checkout = await userSP.web.getFileByServerRelativePath(spFileInfo.ServerRelativeUrl).checkout();
			logger.info("DOCUMENT CHECKED OUT");
		}
		const acxdata = `\n--registerdoc\n\n<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Document>\n<Title>${title}</Title>\n<HasFile>true</HasFile>\n${payload}</Document>\n\n--registerdoc\n\nX-Filename: ${spFileInfo.Name}\n\n${buffbase64}\n\n--registerdoc--`
		logger.info("PUSH Create "+spFileInfo.Name+": Sending request for creating file in Aconex. Payload "+ acxdata)
		logger.info("PUSH Create "+spFileInfo.Name+": Request Headers - "+ JSON.stringify(headers))
		const y = await axios.post(
			`${instanceDetails.AconexURL}/api/projects/${config.AconexProjectID}/register`,
			acxdata,
			{
				auth: {
					username: instanceDetails.ServiceAccountName,
					password: decryptedPassword(instanceDetails.Password)
				},
				headers: headers,
				maxContentLength: Infinity,
				maxBodyLength: Infinity
			}
		)
		const response = await parseStringPromise(y.data)
		const success = response.RegisterDocumentResult.Success[0];
		let status: OperationStatus = OperationStatus.PENDING 
		let error: string = ''
		if(success=='true'){
			logger.info("PUSH Create "+spFileInfo.Name+": Document created successfully")
            status = OperationStatus.SUCCESSFULL
		}else{
			logger.info("PUSH Create "+spFileInfo.Name+": Document failed to sync")
			status = OperationStatus.FAILED
			error = "Document failed to sync from Aconex"
        }
		const updateData: {FieldName: string,FieldValue: any}[] = []
		
		if(Object.keys(metadata).includes("AconexVersion") && status===OperationStatus.SUCCESSFULL){
			updateData.push({FieldName: 'AconexVersion', FieldValue: '1'})
		}
		if(Object.keys(metadata).includes("Operation")){
			updateData.push({FieldName: 'Operation', FieldValue: OperationActions.PUSH})
		}
		if(Object.keys(metadata).includes("AconexSync")){
			updateData.push({FieldName: 'AconexSync', FieldValue: status===OperationStatus.SUCCESSFULL?'true':'false'})
		}
		logger.info("PUSH Create "+spFileInfo.Name+": Data to update in SP: "+ JSON.stringify(updateData))
		logger.info("PUSH Create "+spFileInfo.Name+": Sending request to update metadata in SP.")
		await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).
		validateUpdateListItem(updateData,true);
		logger.info("PUSH Create "+spFileInfo.Name+": SP metadata updated successfully.")
		let updateQuery = `UPDATE Transactions SET
                                Status = '${status}',
                                Error = '${error}'
                                WHERE TransactionNumber = '${trxno}'    
                            `
		logger.info("PUSH Create "+spFileInfo.Name+": Updating transaction. Query: "+ updateQuery)
        await mssql.query(updateQuery)
		logger.info("PUSH Create "+spFileInfo.Name+": Transaction updated successfully ")
        return {sync: true, error: error} as OperationResponse
	}catch(e: any){
		if(e.stack){
			logger.error(line("PUSH Create Error: "+spFileInfo.Name+" - "+ JSON.stringify(e.stack)))
		}
		let error = e.message
		if(e.response && e.response.data){
			const errObj = await parseStringPromise(e.response.data)
			error = errObj.Error.ErrorDescription[0]
		}
		logger.error(line("PUSH Create Error: "+spFileInfo.Name+" - "+ error))
		const updateData: {FieldName: string,FieldValue: any}[] = []
		if(Object.keys(metadata).includes("Operation")){
			updateData.push({FieldName: 'Operation', FieldValue: OperationActions.PUSH})
		}
		if(Object.keys(metadata).includes("AconexSync")){
			updateData.push({FieldName: 'AconexSync', FieldValue: 'false'})
		}
		logger.info("PUSH Create "+spFileInfo.Name+": Data to update in SP: "+ JSON.stringify(updateData))
		logger.info("PUSH Create "+spFileInfo.Name+": Sending request to update metadata in SP.")
		await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).
		validateUpdateListItem(updateData,true);
		logger.info("PUSH Create "+spFileInfo.Name+": SP metadata updated successfully.")
        const updateQuery = `UPDATE Transactions SET
                                Status = '${OperationStatus.FAILED}',
                                Error = '${error}'
                                WHERE TransactionNumber = '${trxno}'    
                            `
							
		logger.info("PUSH Create "+spFileInfo.Name+": Updating transaction. Query: "+ updateQuery)
        await mssql.query(updateQuery)
		logger.info("PUSH Create "+spFileInfo.Name+": Transaction updated successfully ")
		return {sync: false, error: error} as OperationResponse
	}
}

const createVersion = async (itemid: number,userSP: SPRest,user: ISiteUserInfo,config: SiteProfileSetting,instanceDetails: AconexInstanceCredentials,mssql: ConnectionPool,library: IListInfo,aconexAttributes: AconexAttributes[],attributesMapping: AttributesMapping[],mapping: MetadataMapping,project: AconexProject): Promise<OperationResponse> => {
	let spFileInfo: IFileInfo
	let payload = "";
	let headers: any
	let documentNo: string = ''
	let revisionNo: string = ''
	const trxno = "TRX-" + Date.now()+"-"+(Math.floor(Math.random()*(999-100+1)+100));
	let metadata: any;
	let buffbase64: any
	logger.info("PUSH - Versioning Document Begins")
	try{
		const list = await userSP.web.lists.getByTitle(library.Title).items.getById(itemid).select('File').expand("File").get();
		spFileInfo = list.File;
		logger.info("PUSH - FileInfo : "+ JSON.stringify(spFileInfo))
		logger.info("PUSH - Versioning Document in Aconex : "+ spFileInfo.Name)
		metadata = await userSP.web.getFolderByServerRelativePath(spFileInfo.ServerRelativeUrl).listItemAllFields();
		logger.info("PUSH Version: "+spFileInfo.Name+" File Metadata: "+ JSON.stringify(metadata))
		const versionHistory = await userSP.web.lists.getByTitle(library.Title).items.getById(itemid).select('Versions').expand('Versions').get();
		const spversion: number = parseInt(versionHistory.Versions[0].VersionLabel);
		logger.info("PUSH Version: "+spFileInfo.Name+" SP Version No.: "+ spversion)
		logger.info("PUSH Version: "+spFileInfo.Name+" - Sending Request to download file from SP")
		const buffer = await userSP.web.getFileByServerRelativePath(spFileInfo.ServerRelativeUrl).getBuffer();
		logger.info("PUSH Version: "+spFileInfo.Name+" - File downloaded successfully from SP")
		const length = buffer.byteLength
		headers = {
							"Content-Type": "multipart/mixed",
							"boundry": "registerdoc"
						}
		if(length/Math.pow(10,6) > 100){
			headers['Transfer-Encoding'] ='chunked' 
		}
		var buff = Buffer.from(new Uint8Array(buffer));
		buffbase64 = buff.toString('base64');
		var title = metadata["Title"] && metadata["Title"]!='' ?metadata["Title"]:spFileInfo.Name;
		title = escapeString(title)
		let keys = Object.keys(mapping)
		for(let k of keys){
			const attrindex =  aconexAttributes.findIndex(a => a.CreateIdentifier===k)
			if(attrindex > -1){
				let attribute = aconexAttributes[attrindex];
				let attributeValue = metadata[mapping[k]];
				if(attributeValue!=null && attributeValue!=undefined){
					if(k!=='DocumentNumber'){
						if(attribute.CreateIdentifier=="AccessList"){
							let users: any = []
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
							attributeValue = users
						}
						if(checkDate(attributeValue)){
							attributeValue = new Date(Date.parse(attributeValue)).toISOString()
						}
						if(k==='DocumentTypeId' || k==='DocumentStatusId'){
							const mappingIndex = attributesMapping.findIndex(m => m.StringValue===attributeValue)
							if(mappingIndex > -1){
								attributeValue = attributesMapping[mappingIndex].IntegerValue
							}
						}
						if(Array.isArray(attributeValue)){
							for(let i of attributeValue){
								payload += `<${attribute.CreateIdentifier}>${escapeString(i)}</${attribute.CreateIdentifier}>\n`
							}
						}else{
							payload += `<${attribute.CreateIdentifier}>${escapeString(attributeValue)}</${attribute.CreateIdentifier}>\n`
						}
						
					}
					if(k === 'DocumentNumber'){
						documentNo = attributeValue.toString()
					}
					if(k === 'Revision'){
						revisionNo = attributeValue.toString()
					}
				}
				
			}
		}
		logger.info("PUSH Version: "+spFileInfo.Name+" Document No.: "+ documentNo)
		logger.info("PUSH Version: "+spFileInfo.Name+" Revision: "+ revisionNo)
		const transactionQuery = `INSERT INTO Transactions VALUES(
			'${trxno}',
			'${spFileInfo.Name}',
			'${documentNo}',
			'${spFileInfo.UniqueId}',
			'${OperationActions.PUSH}',
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
			'${OperationStatus.PENDING}',
			''
		)`
		logger.info("PUSH Version: Transaction Query "+spFileInfo.Name+" - "+ transactionQuery)
		logger.info("PUSH Version: Saving the transaction")
		await mssql.query(transactionQuery)
		logger.info("PUSH Version: Transaction saved successfully")
	}catch(e: any){
		if(e.stack){
			logger.error(line("PUSH Version Error:"+ JSON.stringify(e.stack)))
		}
		logger.error(line("PUSH Version Error:"+ e.message))
		return {sync: false, error: "Internal Server Error"} as OperationResponse
	}
	
	let acxdata = `\n--registerdoc\n\n<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Document>\n<Title>${title}</Title>\n<HasFile>true</HasFile>\n${payload}</Document>\n\n--registerdoc\n\nX-Filename: ${spFileInfo.Name}\n\n${buffbase64}\n\n--registerdoc--`
	
	logger.info("PUSH Version "+spFileInfo.Name+": Sending request to get latest version of document from Aconex")
	const c = await axios.get(
		`${instanceDetails.AconexURL}/api/projects/${config.AconexProjectID}/register?search_query=docno:${documentNo}&return_fields=versionnumber`,
		{
			auth: {
				username: instanceDetails.ServiceAccountName,
				password: decryptedPassword(instanceDetails.Password)
			}
		}
	)
	const r = await parseStringPromise(c.data)
	if (r.RegisterSearch && r.RegisterSearch.SearchResults && parseInt(r.RegisterSearch.$.TotalResults) > 0 && r.RegisterSearch.SearchResults[0].Document[0]) {
		logger.info("PUSH Version "+spFileInfo.Name+": File exists in Aconex")
		const docId = r.RegisterSearch.SearchResults[0].Document[0]['$'].DocumentId;
		let ackversion = r.RegisterSearch.SearchResults[0].Document[0].VersionNumber[0];
		logger.info("PUSH Version: "+spFileInfo.Name+" Aconex Document ID.: "+ docId)
		logger.info("PUSH Version: "+spFileInfo.Name+" Aconex Version No.: "+ ackversion)
		try{
			if(process.env.CHECKIN_CHECKOUT == "TRUE")
			{
				logger.info("CHECKING OUT THE DOCUMENT")
				const checkout = await userSP.web.getFileByServerRelativePath(spFileInfo.ServerRelativeUrl).checkout();
				logger.info("DOCUMENT CHECKED OUT");
			}
			logger.info("PUSH Version "+spFileInfo.Name+": Sending request for creating file in Aconex. Payload "+ acxdata)
			logger.info("PUSH Version "+spFileInfo.Name+": Request Headers - "+ JSON.stringify(headers))
			const y = await axios.post(
				`${instanceDetails.AconexURL}/api/projects/${config.AconexProjectID}/register/${docId}/supersede`,
				acxdata,
				{
					auth: {
						username: instanceDetails.ServiceAccountName,
						password: decryptedPassword(instanceDetails.Password)
					},
					headers: headers,
					maxContentLength: Infinity,
					maxBodyLength: Infinity
				}
			)
			const response = await parseStringPromise(y.data)
			const success = response.RegisterDocumentResult.Success[0];
			const newDocId = response.RegisterDocumentResult.RegisterDocument[0];
			if(success==='true'){
				logger.info("PUSH Version "+spFileInfo.Name+": Document created successfully")
				const updateData: {FieldName: string,FieldValue: any}[] = []
				if(Object.keys(metadata).includes("AconexVersion")){
					updateData.push({FieldName: 'AconexVersion', FieldValue: (parseInt(ackversion) + 1).toString()})
				}
				if(Object.keys(metadata).includes("Operation")){
					updateData.push({FieldName: 'Operation', FieldValue: OperationActions.PUSH})
				}
				if(Object.keys(metadata).includes("AconexSync")){
					updateData.push({FieldName: 'AconexSync', FieldValue: 'true'})
				}
				logger.info("PUSH Version "+spFileInfo.Name+": Data to update in SP: "+ JSON.stringify(updateData))
				logger.info("PUSH Version "+spFileInfo.Name+": Sending request to update metadata in SP.")
				
				await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).
				validateUpdateListItem(updateData, true);
				logger.info("PUSH Version "+spFileInfo.Name+": SP metadata updated successfully.")
				const updateQuery = `UPDATE Transactions SET
                                Status = '${OperationStatus.SUCCESSFULL}',
                                Error = '',
                                AconexDocVersionNo = '${ackversion}'
                                WHERE TransactionNumber = '${trxno}'    
                            `
				logger.info("PUSH Version "+spFileInfo.Name+": Updating transaction. Query: "+ updateQuery)
                await mssql.query(updateQuery)
				logger.info("PUSH Version "+spFileInfo.Name+": Transaction updated successfully ")
				return {sync: true, error: ''} as OperationResponse
			}else{
				const updateData: {FieldName: string,FieldValue: any}[] = []
				if(Object.keys(metadata).includes("Operation")){
					updateData.push({FieldName: 'Operation', FieldValue: OperationActions.PUSH})
				}
				if(Object.keys(metadata).includes("AconexSync")){
					updateData.push({FieldName: 'AconexSync', FieldValue: 'false'})
				}
				logger.info("PUSH Version "+spFileInfo.Name+": Data to update in SP: "+ JSON.stringify(updateData))
				logger.info("PUSH Version "+spFileInfo.Name+": Sending request to update metadata in SP.")
				await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).
				validateUpdateListItem(updateData, true);
				logger.info("PUSH Version "+spFileInfo.Name+": SP metadata updated successfully.")
                const updateQuery = `UPDATE Transactions SET
                                Status = '${OperationStatus.FAILED}',
                                Error = 'Document failed to sync from Aconex',
                                AconexDocVersionNo = '${ackversion}'
                                WHERE TransactionNumber = '${trxno}'    
                            `
				logger.info("PUSH Version "+spFileInfo.Name+": Updating transaction. Query: "+ updateQuery)
                await mssql.query(updateQuery)
				logger.info("PUSH Version "+spFileInfo.Name+": Transaction updated successfully ")
                return {sync: false, error: 'Document failed to sync from Aconex'} as OperationResponse
            }
		}catch(e: any){
			if(e.stack){
				logger.error(line("PUSH Version Error: "+spFileInfo.Name+" - "+ JSON.stringify(e.stack)))
			}
			let error = e.message
			if(e.response && e.response.data){
				const errObj = await parseStringPromise(e.response.data)
				logger.error(line(errObj.Error.ErrorDescription))
				error = errObj.Error.ErrorDescription[0]
			}
			logger.error(line("PUSH Version Error: "+spFileInfo.Name+" - "+ error))
			const updateData: {FieldName: string,FieldValue: any}[] = []
			if(Object.keys(metadata).includes("Operation")){
				updateData.push({FieldName: 'Operation', FieldValue: OperationActions.PUSH})
			}
			if(Object.keys(metadata).includes("AconexSync")){
				updateData.push({FieldName: 'AconexSync', FieldValue: 'false'})
			}
			logger.info("PUSH Version "+spFileInfo.Name+": Data to update in SP: "+ JSON.stringify(updateData))
			logger.info("PUSH Version "+spFileInfo.Name+": Sending request to update metadata in SP.")
			await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).
			validateUpdateListItem(updateData, true);
			logger.info("PUSH Version "+spFileInfo.Name+": SP metadata updated successfully.")
            const updateQuery = `UPDATE Transactions SET
                                Status = '${OperationStatus.FAILED}',
                                Error = '${error}',
                                AconexDocVersionNo = '${ackversion}'
                                WHERE TransactionNumber = '${trxno}'    
                            `
			logger.info("PUSH Version "+spFileInfo.Name+": Updating transaction. Query: "+ updateQuery)
            await mssql.query(updateQuery)
			logger.info("PUSH Version "+spFileInfo.Name+": Transaction updated successfully ")
			return {sync: false, error: error} as OperationResponse
		}
	}else{
		const updateData: {FieldName: string,FieldValue: any}[] = []
		if(Object.keys(metadata).includes("Operation")){
			updateData.push({FieldName: 'Operation', FieldValue: OperationActions.PUSH})
		}
		if(Object.keys(metadata).includes("AconexSync")){
			updateData.push({FieldName: 'AconexSync', FieldValue: 'false'})
		}
		logger.info("PUSH Version "+spFileInfo.Name+": Data to update in SP: "+ JSON.stringify(updateData))
		logger.info("PUSH Version "+spFileInfo.Name+": Sending request to update metadata in SP.")
		await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).
				validateUpdateListItem(updateData, true);
		logger.info("PUSH Version "+spFileInfo.Name+": SP metadata updated successfully.")
        const updateQuery = `UPDATE Transactions SET
                                Status = '${OperationStatus.FAILED}',
                                Error = 'Document not found in Aconex',
                                WHERE TransactionNumber = '${trxno}'    
                            `
		logger.info("PUSH Version "+spFileInfo.Name+": Updating transaction. Query: "+ updateQuery)
        await mssql.query(updateQuery)
		logger.info("PUSH Version "+spFileInfo.Name+": Transaction updated successfully ")
        return {sync: false, error: 'Document not found in Aconex'} as OperationResponse
    }
}

const pullDocument = async (itemid: number,docNo: string,userSP: SPRest,user: ISiteUserInfo,config: SiteProfileSetting,instanceDetails: AconexInstanceCredentials,mssql: ConnectionPool, library: IListInfo,aconexAttributes: AconexAttributes[],mapping: MetadataMapping,project: AconexProject): Promise<OperationResponse> => {
	const trxno = "TRX-" + Date.now()+"-"+(Math.floor(Math.random()*(999-100+1)+100));
	let documentNo: string = ''
	let revisionNo: string = '' 
	let spFileInfo: IFileInfo
	let metadata: any
	logger.info("PULL - Pulling Document Begins")
	try{
		const list = await userSP.web.lists.getByTitle(library.Title).items.getById(itemid).select('File').expand("File").get();
		spFileInfo = list.File;
		logger.info("PULL - FileInfo : "+ JSON.stringify(spFileInfo))
		logger.info("PULL - Creating Document in Aconex : "+ spFileInfo.Name)
		metadata = await userSP.web.getFolderByServerRelativePath(spFileInfo.ServerRelativeUrl).listItemAllFields();
		logger.info("PULL Create: "+spFileInfo.Name+" File Metadata: "+ JSON.stringify(metadata))
		const versionHistory = await userSP.web.lists.getByTitle(library.Title).items.getById(itemid).select('Versions').expand('Versions').get();
		const spversion: number = parseInt(versionHistory.Versions[0].VersionLabel);
		logger.info("PULL Create: "+spFileInfo.Name+" SP Version No.: "+ spversion)
		let keys = Object.keys(mapping)
		for(let k of keys){
			const attrindex =  aconexAttributes.findIndex(a => a.CreateIdentifier===k)
			if(attrindex > -1){
				let attributeValue = metadata[mapping[k]];
				if(k === 'DocumentNumber'){
					documentNo = attributeValue.toString()
				}
				if(k === 'Revision'){
					revisionNo = attributeValue.toString()
				}
			}
		}
		logger.info("PULL Create: "+spFileInfo.Name+" Document No.: "+ documentNo)
		logger.info("PULL Create: "+spFileInfo.Name+" Revision: "+ revisionNo)
		const transactionQuery = `INSERT INTO Transactions VALUES(
			'${trxno}',
			'${spFileInfo.Name}',
			'${documentNo}',
			'${spFileInfo.UniqueId}',
			'${OperationActions.PULL}',
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
			'${OperationStatus.PENDING}',
			''
		)`
		logger.info("PULL Create: Transaction Query "+spFileInfo.Name+" - "+ transactionQuery)
		logger.info("PULL Create: Saving the transaction")
		await mssql.query(transactionQuery)
		logger.info("PULL Create: Transaction saved successfully")
	}catch(e: any){
		if(e.stack){
			logger.error(line("PULL Create Error:"+ JSON.stringify(e.stack)))
		}
		logger.error(line("PULL Create Error:"+ e.message))
		return {sync: false, error: "Internal Server Error from DB"} as OperationResponse
	}

	try{
			if(process.env.CHECKIN_CHECKOUT == "TRUE")
			{
				logger.info("CHECKING OUT THE DOCUMENT")
				const checkout = await userSP.web.getFileByServerRelativePath(spFileInfo.ServerRelativeUrl).checkout();
				logger.info("DOCUMENT CHECKED OUT");
			}
			logger.info("PULL Version "+spFileInfo.Name+": Sending request to get latest version of document from Aconex")
			const fileSearch = await axios.get(
				`${instanceDetails.AconexURL}/api/projects/${config.AconexProjectID}/register?search_query=docno:${documentNo}&return_fields=versionnumber`,
				{
					auth: {
						username: instanceDetails.ServiceAccountName,
						password: decryptedPassword(instanceDetails.Password)
					}
				}
			)
			const r = await parseStringPromise(fileSearch.data) 
			if (r.RegisterSearch && r.RegisterSearch.SearchResults && r.RegisterSearch.SearchResults.length > 0 && r.RegisterSearch.SearchResults[0].Document[0]) {
				logger.info("PULL Version "+spFileInfo.Name+": File exists in Aconex")
				const docId = r.RegisterSearch.SearchResults[0].Document[0]['$'].DocumentId
		        let ackversion = r.RegisterSearch.SearchResults[0].Document[0].VersionNumber[0];
				logger.info("PULL Version: "+spFileInfo.Name+" Aconex Document ID.: "+ docId)
				logger.info("PULL Version: "+spFileInfo.Name+" Aconex Version No.: "+ ackversion)
				logger.info("PULL Version: "+spFileInfo.Name+"- Sending request for getting document metadata.")
				const acxmetadataReq = await axios.get(
					`${instanceDetails.AconexURL}/api/projects/${config.AconexProjectID}/register/${docId}/metadata`,
					{
						auth: {
							username: instanceDetails.ServiceAccountName,
							password: decryptedPassword(instanceDetails.Password)
						}
					})
					
				const acxmetadata = await parseStringPromise(acxmetadataReq.data);
				const acxmeta = acxmetadata.RegisterDocument;
				
				
				logger.info("PULL Version: "+spFileInfo.Name+"- Aconex Document metadata :" + JSON.stringify(acxmeta))
				logger.info("PULL Version: "+spFileInfo.Name+"- Sending request for updating document in SP.")
				
				const newFilename = acxmeta["Filename"]?acxmeta["Filename"].toString():spFileInfo.Name
				logger.info("PULL Version: New File Name "+ newFilename)

				logger.info("PULL Version: "+spFileInfo.Name+"- Sending request to download file.")
				const index = spFileInfo.ServerRelativeUrl.lastIndexOf("/")
				const serverPath = spFileInfo.ServerRelativeUrl.substr(0, index);
				const aconexFile = await axios.get(
						`${instanceDetails.AconexURL}/api/projects/${config.AconexProjectID}/register/${docId}/markedup?sizeForceFetch=true`,
						{
							auth: {
								username: instanceDetails.ServiceAccountName,
								password: decryptedPassword(instanceDetails.Password)
							},
							responseType:"arraybuffer"
						}
					)
				logger.info("PULL Version: "+spFileInfo.Name+"- File downloaded successfully from Aconex")
				await userSP.web.getFolderByServerRelativePath(serverPath).files.addChunked(spFileInfo.Name, aconexFile.data, undefined, true);
				let updateData: {FieldName: string,FieldValue: any}[] =[]
                const mapping: MetadataMapping = JSON.parse(config.MetadataMapping) 
				let keys = Object.keys(mapping)

				function getTimezone(url: string): string 
				{
					return timezoneMap.get(url) || 'UTC';
				}
				function convertDateToTimezone(dateString: string, timezone: string): string 
				{
					return new Date(dateString).toLocaleString('en-US', { timeZone: timezone });
				}
				const acxurl = instanceDetails.AconexURL;
				const timezones: Record<string, string> = JSON.parse(process.env.TIMEZONES!);
				const aconexsites: string[] = Object.keys(timezones);	
				const timezoneMap: Map<string, string> = new Map();
				aconexsites.forEach((url: string) => 
				{
					if (timezones[url]) 
					{
						timezoneMap.set(url, timezones[url]);
					} else 
					{
						timezoneMap.set(url, 'UTC');
					}
				});
				const timezone: string = getTimezone(acxurl);
				
				updateData.push({FieldName: 'FileLeafRef', FieldValue: newFilename})
				if(Object.keys(metadata).includes("AconexVersion")){
					updateData.push({FieldName: 'AconexVersion', FieldValue: ackversion.toString()})
				}
				if(Object.keys(metadata).includes("Operation")){
					updateData.push({FieldName: 'Operation', FieldValue: OperationActions.PULL})
				}
				if(Object.keys(metadata).includes("AconexSync")){
					updateData.push({FieldName: 'AconexSync', FieldValue: 'true'})
				}


				for(let k of keys)
				{
					const attrindex =  aconexAttributes.findIndex(a => a.CreateIdentifier===k)
					if(attrindex > -1)
					{
						if(acxmeta[aconexAttributes[attrindex].MetadataIdentifier] != null && acxmeta[aconexAttributes[attrindex].MetadataIdentifier] != undefined)
						{
							let metadataValue = acxmeta[aconexAttributes[attrindex].MetadataIdentifier];
							if(metadataValue.length > 1)
							{
								metadataValue = metadataValue.join(";#")
							}
							else if(checkDate(metadataValue[0]))
							{
								// let mataDataDate = new Date(Date.parse(metadataValue[0]));
								const convertedDate = convertDateToTimezone(metadataValue[0], timezone);
								// logger.info(metadataValue[0] + " in UTC || Timezone to convert : " + timezone)
								// logger.info(convertedDate);
								let mataDataDate = new Date(convertedDate);
								// logger.info(mataDataDate)
								metadataValue = (mataDataDate.getMonth() + 1)+'/'+mataDataDate.getDate()+'/'+mataDataDate.getFullYear();
								//metadataValue = mataDataDate.getFullYear()+'-'+(mataDataDate.getMonth() + 1)+'-'+mataDataDate.getDate() // For SNCL
								// logger.info(metadataValue);
							}
							else if(metadataValue[0]["AttributeTypeNames"])
							{
								if(metadataValue[0]["AttributeTypeNames"][0] && metadataValue[0]["AttributeTypeNames"][0]["AttributeTypeName"] &&metadataValue[0]["AttributeTypeNames"][0]["AttributeTypeName"].length > 0){
									metadataValue = metadataValue[0]["AttributeTypeNames"][0]["AttributeTypeName"].join(";#")
								}else{
									metadataValue = ""
								}	
							}
							else
							{
								metadataValue = metadataValue[0]
							}
							updateData.push({FieldName: mapping[k], FieldValue: metadataValue})
						}
					}
				}
				
				logger.info("PULL Version "+spFileInfo.Name+": Data to update in SP: "+ JSON.stringify(updateData))
				logger.info("PULL Version "+spFileInfo.Name+": Sending request to update metadata in SP.")
				let updatemetadata = await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).validateUpdateListItem(updateData,true);
				logger.info("PULL Version "+spFileInfo.Name+": SP metadata updated successfully." + JSON.stringify(updatemetadata))
				if(updatemetadata.length > 0){
					for(let m of updatemetadata){
						if(m.HasException){
							let errormsg = m.ErrorMessage+' for field '+ m.FieldName;
							throw new Error(errormsg)
						}
					}
				}

                const updateQuery = `UPDATE Transactions SET
                                Status = '${OperationStatus.SUCCESSFULL}',
                                Error = '',
                                AconexDocVersionNo = '${ackversion}'
                                WHERE TransactionNumber = '${trxno}'    
                            `
				logger.info("PULL Version "+spFileInfo.Name+": Updating transaction. Query: "+ updateQuery)
                await mssql.query(updateQuery)
				logger.info("PUSH Version "+spFileInfo.Name+": Transaction updated successfully ")
				return {sync: true,error: ''} as OperationResponse
			}else{
				const updateData: {FieldName: string,FieldValue: any}[] =[]
				if(Object.keys(metadata).includes("Operation")){
					updateData.push({FieldName: 'Operation', FieldValue: OperationActions.PULL})
				}
				if(Object.keys(metadata).includes("AconexSync")){
					updateData.push({FieldName: 'AconexSync', FieldValue: 'false'})
				}
				logger.info("PULL Version "+spFileInfo.Name+": Data to update in SP: "+ JSON.stringify(updateData))
				logger.info("PULL Version "+spFileInfo.Name+": Sending request to update metadata in SP.")
				
				await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).
						validateUpdateListItem(updateData,true);
				logger.info("PULL Version "+spFileInfo.Name+": SP metadata updated successfully.")
                const updateQuery = `UPDATE Transactions SET
                                Status = '${OperationStatus.FAILED}',
                                Error = 'Document not availabe in Aconex'
                                WHERE TransactionNumber = '${trxno}'    
                            `
				logger.info("PULL Version "+spFileInfo.Name+": Updating transaction. Query: "+ updateQuery)
                await mssql.query(updateQuery)
				logger.info("PULL Version "+spFileInfo.Name+": Transaction updated successfully ")
                return {sync: false, error: "Document not available in Aconex"} as OperationResponse
            }
	}catch(e: any){
		if(e.stack){
			logger.error(line("PULL Version Error: "+spFileInfo.Name+" - "+ JSON.stringify(e.stack)))
		}
		let error = e.message
		if(e.response && e.response.data){
			const errObj = await parseStringPromise(e.response.data)
			logger.error(line(errObj.Error.ErrorDescription))
			error = errObj.Error.ErrorDescription[0]
		}
		logger.error(line("PULL Version Error: "+spFileInfo.Name+" - "+ error))
		const updateData: {FieldName: string,FieldValue: any}[] =[]
		if(Object.keys(metadata).includes("Operation")){
			updateData.push({FieldName: 'Operation', FieldValue: OperationActions.PULL})
		}
		if(Object.keys(metadata).includes("AconexSync")){
			updateData.push({FieldName: 'AconexSync', FieldValue: 'false'})
		}
		logger.info("PULL Version "+spFileInfo.Name+": Data to update in SP: "+ JSON.stringify(updateData))
		logger.info("PULL Version "+spFileInfo.Name+": Sending request to update metadata in SP.")
		await (userSP.web.lists.getByTitle(library.Title)).items.getById(itemid).
				validateUpdateListItem(updateData,true);
		logger.info("PULL Version "+spFileInfo.Name+": SP metadata updated successfully.")
        const updateQuery = `UPDATE Transactions SET
                                Status = '${OperationStatus.FAILED}',
                                Error = '${error}'
                                WHERE TransactionNumber = '${trxno}'    
                            `
		logger.info("PULL Version "+spFileInfo.Name+": Updating transaction. Query: "+ updateQuery)
        await mssql.query(updateQuery)
		logger.info("PULL Version "+spFileInfo.Name+": Transaction updated successfully ")
		return {sync: false, error: error} as OperationResponse
	}
}

export {createDocument, createVersion, pullDocument}