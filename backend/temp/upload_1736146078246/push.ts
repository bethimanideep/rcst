import { IFileInfo, IListInfo, SPRest } from '@pnp/sp-commonjs';
import axios from 'axios';
import { parseStringPromise } from "xml2js";
import express, { Request, Response } from 'express'
import DatabaseConnect from '../shared/database';
import { ConnectionPool } from 'mssql';
import { createDocument, createVersion } from '../shared/common';
import { ISiteUserInfo } from '@pnp/sp-commonjs/site-users/types';
import { AconexAttributes, AconexInstanceCredentials, AconexProject, AttributesMapping, DocumentPushActions, DocumentPushDetails, DocumentPushRequest, Messages, MetadataMapping, OperationActions, OperationResponse, SiteProfileSetting } from '../types/types';
import { checkAuth, checkAuthFromCookie } from '../middlewares/check-auth';
import { InternalServerError } from '../errors/internal-server-error';
import { getAconexAttributes, getAconexAttributesMapping, getAconexInstanceDetails, getAconexProjectDetails, getSiteProfileSetting } from '../shared/db-operations';
import { checkAccessUser } from '../middlewares/check-access-user';
import { decryptedPassword } from '../shared/password';
import { logger } from '../lib/logger';
import { line } from '../index';


const router = express.Router()

router.post('/push', checkAuth,checkAccessUser, async (req: Request, res: Response) => 
{
    logger.info("PUSH VIEW:Connecting To Database")
    const mssql: ConnectionPool | null = await DatabaseConnect()
    if(mssql)
    {
        logger.info("PUSH VIEW:Connected To Database")
        const SiteList: string = req.query && req.query.sListId ?req.query.sListId.toString(): '';
        logger.info("PUSH VIEW:Site Library ID: "+ SiteList)
        const userSP: SPRest  = req.userSP!
        let user: ISiteUserInfo = req.user!
        const SPSite: string = req.body.SPSiteUrl;
        const spItemIds = req.query && req.query.sItemId ?req.query.sItemId.toString().split(','):[];
        logger.info("PUSH VIEW: Document IDs: "+ JSON.stringify(spItemIds))
        const library: IListInfo = await userSP.web.lists.getById(SiteList).select("Title")();
        logger.info("PUSH VIEW:Site Library: "+ library.Title)
        let config!: SiteProfileSetting
        let instanceDetails!: AconexInstanceCredentials 
        let project!: AconexProject 
        let aconexAttributes!: AconexAttributes[]
        
        config = await getSiteProfileSetting(mssql,SPSite,library.Title) 
        logger.info("PUSH VIEW: Aconex SP Configuration: "+ JSON.stringify(config))
        //below
        instanceDetails = await getAconexInstanceDetails(mssql,config.AconexInstanceURL,config.AconexInstanceName)
        logger.info("PUSH VIEW: Aconex Instance Details: "+ JSON.stringify(instanceDetails))
        //below
        project = await getAconexProjectDetails(mssql,config.AconexInstanceURL,config.AconexProjectID,config.AconexInstanceName)
        logger.info("PUSH VIEW: Aconex Project : "+ JSON.stringify(project))
        aconexAttributes = await getAconexAttributes(mssql);
        logger.info("PUSH VIEW: Aconex Attributes : "+ JSON.stringify(aconexAttributes))
        
        let fileDetails: DocumentPushDetails[] = [];
        let promiseArray: Promise<DocumentPushDetails>[] = []
        const mapping: MetadataMapping = JSON.parse(config.MetadataMapping) 
	    let keys = Object.keys(mapping)
        logger.info("PUSH VIEW: Looping through documents")
        for(let spItemId of spItemIds)
        {
            var responsePromise: Promise<DocumentPushDetails> = new Promise(async (resolve,reject) => 
            {
                try
                {
                    const list = await userSP.web.lists.getByTitle(library.Title).items.getById(parseInt(spItemId)).select('File').expand("File").get();
                    const spFileInfo: IFileInfo = list.File;
                    logger.info("PUSH VIEW: File Name: "+ spFileInfo.Name)
                    const metadata = await userSP.web.getFolderByServerRelativePath(spFileInfo.ServerRelativeUrl).listItemAllFields();
                    logger.info("PUSH VIEW: "+spFileInfo.Name+" File Metadata: "+ JSON.stringify(metadata))
                    const versionHistory = await userSP.web.lists.getByTitle(library.Title).items.getById(parseInt(spItemId)).select('Versions').expand('Versions').get();
                    let spversion = parseInt(versionHistory.Versions[0].VersionLabel);
                    logger.info("PUSH VIEW: "+spFileInfo.Name+" SP Version No.: "+ spversion)
                    let documentNo: string = ''
                    for(let k of keys)
                    {
                        const attrindex =  aconexAttributes.findIndex(a => a.CreateIdentifier===k)
                        if(attrindex > -1)
                        {
                            let attributeValue = metadata[mapping[k]];
                            if(k === 'DocumentNumber')
                            {
                                documentNo = attributeValue?attributeValue.toString():''
                            }
                        }
                    }
                    logger.info("PUSH VIEW: "+spFileInfo.Name+" Document No.: "+ documentNo)
                    let action: DocumentPushActions
                    let ackversion
                    let message: string = ''
                    if(documentNo!='')
                    {
                        logger.info("PUSH VIEW: "+spFileInfo.Name+" Searching file in Aconex ")
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
                        if (r.RegisterSearch && r.RegisterSearch.SearchResults && r.RegisterSearch.$.TotalResults !='0' &&  r.RegisterSearch.SearchResults.length > 0 && r.RegisterSearch.SearchResults[0].Document[0]) 
                        {
                            logger.info("PUSH VIEW: "+spFileInfo.Name+" File found in Aconex")
                            ackversion = r.RegisterSearch.SearchResults[0].Document[0].VersionNumber[0];
                            logger.info("PUSH VIEW: "+spFileInfo.Name+" Aconex Version No.: "+ ackversion)
                            if(spversion > parseInt(ackversion))
                            {
                                logger.info("PUSH VIEW: "+spFileInfo.Name+" to be added a be version in Aconex.")
                                action = DocumentPushActions.VERSION
                                message = Messages.VERSION
                            }
                            else
                            {
                                logger.info("PUSH VIEW: "+spFileInfo.Name+" is already up to date in Aconex.")
                                action = DocumentPushActions.UPDATED
                                message = Messages.UPDATED
                            }
                            
                        }
                        else
                        {
                            logger.info("PUSH VIEW: "+spFileInfo.Name+" File not found in Aconex, need to push the file in Aconex")
                            ackversion = ""
                            action= DocumentPushActions.CREATE
                            message = Messages.CREATE
                        }
                    }
                    else
                    {
                        logger.info("PUSH VIEW: "+spFileInfo.Name+" Document No is not available.")
                        action= DocumentPushActions.DOCNOREQUIRED
                        message = Messages.DOCNOREQUIRED
                    }
                    let viewDetails: DocumentPushDetails = {documentNo: documentNo,revision: metadata.Revision,spVersion:spversion,ackVersion:ackversion,  documentName:spFileInfo.Name,action:action,instance:instanceDetails.InstanceName,projectName: project.ProjectName, project:config.AconexProjectID,site: config.SharepointSite,itemId: parseInt(spItemId),message: message,operation:OperationActions.PUSH,user:user.Title}
                    logger.info("PUSH VIEW: "+spFileInfo.Name+" Data to view."+ JSON.stringify(viewDetails))
                    resolve(viewDetails)
                }
                catch(err: any)
                {
                    logger.error(line("PUSH VIEW: Failed to get document details ID: "+ spItemId+ " with error: "+err.message))
                    reject(Messages.ERRORDOCFETCH)
                }
            })
            promiseArray.push(responsePromise)           
        }
        try
        {
            fileDetails = await Promise.all(promiseArray);
        }
        catch(err: any)
        {
            logger.error(line("PUSH VIEW: Failed to get the Documents: "+ err.message));
            throw new InternalServerError(err)
        }       
        res.render("push",{fileDetails: fileDetails})
    }
})

router.post("/aconex/create",checkAuthFromCookie,checkAccessUser,async (req: Request,res: Response) => 
{
    logger.info("PUSH TO ACONEX: Connecting To Database")
    const mssql: ConnectionPool | null = await DatabaseConnect()
    if(mssql)
    {
        logger.info("PUSH TO ACONEX: Connected To Database")
        const SiteList: string = req.cookies.SiteLibrary;
        logger.info("PUSH TO ACONEX:Site Library ID: "+ SiteList)
        const userSP: SPRest  = req.userSP!
        let user: ISiteUserInfo = req.user!
        const SPSite: string = req.cookies.SPSiteUrl;
        const library: IListInfo = await userSP.web.lists.getById(SiteList).select("Title")();
        logger.info("PUSH TO ACONEX: Site Library: "+ library.Title)
        let config!: SiteProfileSetting
        let instanceDetails!: AconexInstanceCredentials 
        let project!: AconexProject 
        let aconexAttributes!: AconexAttributes[]
        let attributesMapping: AttributesMapping[]
        config = await getSiteProfileSetting(mssql,SPSite,library.Title)
        logger.info("PUSH TO ACONEX: Aconex SP Configuration: "+ JSON.stringify(config)) 
        //below line
        instanceDetails = await getAconexInstanceDetails(mssql,config.AconexInstanceURL,config.AconexInstanceName)
        logger.info("PUSH TO ACONEX: Aconex Instance Details: "+ JSON.stringify(instanceDetails))
        //below
        project = await getAconexProjectDetails(mssql,config.AconexInstanceURL,config.AconexProjectID,config.AconexInstanceName)
        logger.info("PUSH TO ACONEX: Aconex Project : "+ JSON.stringify(project))
        aconexAttributes = await getAconexAttributes(mssql);
        logger.info("PUSH TO ACONEX: Aconex Project : "+ JSON.stringify(aconexAttributes))
        attributesMapping = await getAconexAttributesMapping(mssql,config.AconexProjectID)
        logger.info("PUSH TO ACONEX: Aconex Attributes : "+ JSON.stringify(attributesMapping))
        const mapping: MetadataMapping = JSON.parse(config.MetadataMapping)
        const spItemIds: DocumentPushRequest[] = req.body.spItemIds;
        let fileResponse: OperationResponse[] = []
        if(spItemIds.length > 0)
        {
            let syncObj: OperationResponse
            try
            {
                logger.info("PUSH TO ACONEX: Looping through the documents ids")
                for(let i of spItemIds)
                {
                    logger.info("PUSH TO ACONEX: Document: "+ JSON.stringify(i))
                    if(i.action===DocumentPushActions.CREATE)
                    {
                        logger.info(i.item)
                        syncObj = await createDocument(i.item, userSP, user,config,instanceDetails,mssql, library,aconexAttributes,attributesMapping,mapping,project!)
                        logger.info("PUSH TO ACONEX: Create Document response: "+ JSON.stringify(syncObj))
                        fileResponse.push({...syncObj,item: i.item} as OperationResponse )
                    }
                    else
                    {
                        syncObj = await createVersion(i.item, userSP, user,config,instanceDetails,mssql, library,aconexAttributes,attributesMapping,mapping,project!)
                        logger.info("PUSH TO ACONEX: Create Version push response: "+ JSON.stringify(syncObj))
                        fileResponse.push({...syncObj,item: i.item} as OperationResponse )
                    }
                }
            }
            catch(e: any)
            {
                logger.error(line("PUSH TO ACONEX: Error Occurred: "+ e.message))
                throw new InternalServerError(Messages.COMMON)
            }
        }
        res.send(fileResponse)
    }
})

export {router as DocumentPush}