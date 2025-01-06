import { IFileInfo, IListInfo, SPRest } from '@pnp/sp-commonjs';
import { ISiteUserInfo } from '@pnp/sp-commonjs/site-users/types';
import axios from 'axios';
import express, { Request, Response } from 'express'
import { ConnectionPool, } from 'mssql';
import { AconexAttributes, AconexInstanceCredentials, AconexProject, DocumentPullActions, DocumentPullDetails, DocumentPullRequest, Messages, MetadataMapping, OperationActions, OperationResponse, SiteProfileSetting } from '../types/types';
import DatabaseConnect from '../shared/database';
import  { parseStringPromise } from "xml2js";
import { pullDocument } from '../shared/common';
import { checkAuth, checkAuthFromCookie } from '../middlewares/check-auth';
import { getAconexAttributes, getAconexInstanceDetails, getAconexProjectDetails, getSiteProfileSetting } from '../shared/db-operations';
import { InternalServerError } from '../errors/internal-server-error';
import { checkAccessUser } from '../middlewares/check-access-user';
import { decryptedPassword } from '../shared/password';
import { logger } from '../lib/logger';
import { line } from '../index';


const router = express.Router();

router.post("/aconex/pull",checkAuthFromCookie,checkAccessUser,async (req: Request,res: Response) => 
{
    logger.info("PULL FROM ACONEX: Connecting To Database")
    const mssql: ConnectionPool | null = await DatabaseConnect()
    if(mssql)
    {
        try
        {
            logger.info("PULL FROM ACONEX: Connected To Database")
            const SiteList: string = req.cookies.SiteLibrary;
            logger.info("PULL FROM ACONEX:Site Library ID: "+ SiteList)
            const userSP: SPRest  = req.userSP!
            let user: ISiteUserInfo = req.user!
            const SPSite: string = req.cookies.SPSiteUrl;
            const library: IListInfo = await userSP.web.lists.getById(SiteList).select("Title")();
            logger.info("PULL FROM ACONEX: Site Library: "+ library.Title)
            let config!: SiteProfileSetting
            let instanceDetails!: AconexInstanceCredentials 
            let project!: AconexProject 
            let aconexAttributes!: AconexAttributes[]
            config = await getSiteProfileSetting(mssql,SPSite,library.Title) 
            logger.info("PULL FROM ACONEX: Aconex SP Configuration: "+ JSON.stringify(config)) 
            //below
            instanceDetails = await getAconexInstanceDetails(mssql,config.AconexInstanceURL,config.AconexInstanceName)
            logger.info("PULL FROM ACONEX: Aconex Instance Details: "+ JSON.stringify(instanceDetails))
            //below
            project = await getAconexProjectDetails(mssql,config.AconexInstanceURL,config.AconexProjectID,config.AconexInstanceName)
            logger.info("PULL FROM ACONEX: Aconex Project : "+ JSON.stringify(project))
            aconexAttributes = await getAconexAttributes(mssql);
            logger.info("PULL FROM ACONEX: Aconex Project : "+ JSON.stringify(aconexAttributes))
            const mapping: MetadataMapping = JSON.parse(config.MetadataMapping)
            const spItemIds: DocumentPullRequest[] = req.body.spItemIds;
            let fileResponse: OperationResponse[] = []
            if(spItemIds.length > 0)
            {
                logger.info("PULL FROM ACONEX: Looping through the documents ids")
                for(let i of spItemIds)
                {
                    logger.info("PULL FROM ACONEX: Document: "+ JSON.stringify(i))
                    if(i.action===DocumentPullActions.EXISTS)
                    {
                        let syncObj: OperationResponse = await pullDocument(i.item, i.docNo,userSP, user,config,instanceDetails,mssql,library,aconexAttributes,mapping,project!)
                        logger.info("PULL FROM ACONEX: Pull Document response: "+ JSON.stringify(syncObj))
                        fileResponse.push({...syncObj,item: i.item} as OperationResponse)
                    }
                }
            }
            res.send(fileResponse)
        }
        catch(err: any)
        {
            logger.error(line(err.message));
            throw new InternalServerError(err);
        }      
    }
})

router.post("/pull", checkAuth, checkAccessUser,async (req: Request,res: Response) => 
{
    logger.info("PULL VIEW: Connecting to Database")
    const mssql: ConnectionPool | null = await DatabaseConnect()
    if(mssql)
    {
        logger.info("PULL VIEW: Connected to Database") 
        const SiteList: string = req.query && req.query.sListId ?req.query.sListId.toString(): '';
        logger.info("PULL VIEW:Site Library ID: "+ SiteList)
        const userSP: SPRest  = req.userSP!
        let user: ISiteUserInfo = req.user!
        const SPSite: string = req.body.SPSiteUrl;
        const spItemIds = req.query && req.query.sItemId? req.query.sItemId.toString().split(','):'';
        logger.info("PULL VIEW: Document IDs: "+ JSON.stringify(spItemIds))
        const library: IListInfo = await userSP.web.lists.getById(SiteList).select("Title")();
        logger.info("PULL VIEW:Site Library: "+ library.Title)
        let config!: SiteProfileSetting
        let instanceDetails!: AconexInstanceCredentials 
        let project!: AconexProject 
        let aconexAttributes!: AconexAttributes[]
        config = await getSiteProfileSetting(mssql,SPSite,library.Title)
        logger.info("PULL VIEW: Aconex SP Configuration: "+ JSON.stringify(config)) 
        //below
        instanceDetails = await getAconexInstanceDetails(mssql,config.AconexInstanceURL,config.AconexInstanceName)
        logger.info("PULL VIEW: Aconex Instance Details: "+ JSON.stringify(instanceDetails))
        //below
        project = await getAconexProjectDetails(mssql,config.AconexInstanceURL,config.AconexProjectID,config.AconexInstanceName)
        logger.info("PULL VIEW: Aconex Project : "+ JSON.stringify(project))
        aconexAttributes = await getAconexAttributes(mssql);
        logger.info("PULL VIEW: Aconex Attributes : "+ JSON.stringify(aconexAttributes))

        const mapping: MetadataMapping = JSON.parse(config.MetadataMapping) 
	    let keys = Object.keys(mapping)
        let fileDetails: DocumentPullDetails[] = [];
        let promiseArray: Promise<DocumentPullDetails>[] = []
        logger.info("PULL VIEW: Looping through documents")
        for(let spItemId of spItemIds)
        {
            var responsePromise: Promise<DocumentPullDetails> = new Promise(async (resolve,reject) => {
                try
                {
                    const list = await userSP.web.lists.getByTitle(library.Title).items.getById(parseInt(spItemId)).select('File').expand("File").get();
                    const spFileInfo: IFileInfo = list.File;
                    logger.info("PULL VIEW: File Name: "+ spFileInfo.Name)
                    const metadata = await userSP.web.getFolderByServerRelativePath(spFileInfo.ServerRelativeUrl).listItemAllFields();
                    logger.info("PULL VIEW: "+spFileInfo.Name+" File Metadata: "+ JSON.stringify(metadata))
                    const versionHistory = await userSP.web.lists.getByTitle(library.Title).items.getById(parseInt(spItemId)).select('Versions').expand('Versions').get();
                    let spversion: number = parseInt(versionHistory.Versions[0].VersionLabel);
                    let acxversioninSP: number = parseInt(metadata.AconexVersion);
                    let documentNo: string = ''
                    logger.info("PULL VIEW: "+spFileInfo.Name+" SP Version No.: "+ spversion)
                    for(let k of keys){
                        const attrindex =  aconexAttributes.findIndex(a => a.CreateIdentifier===k)
                        if(attrindex > -1){
                            let attributeValue = metadata[mapping[k]];
                            if(k === 'DocumentNumber'){
                                documentNo = attributeValue?attributeValue.toString():''
                            }
                        }
                    }
                    logger.info("PULL VIEW: "+spFileInfo.Name+" Document No.: "+ documentNo)
                    let action: DocumentPullActions = DocumentPullActions.NOTEXISTS
                    let ackversion
                    let message: string = ''
                    if(documentNo!='')
                    {
                        logger.info("PULL VIEW: "+spFileInfo.Name+" Searching file in Aconex ")
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
                            logger.info("PULL VIEW: "+spFileInfo.Name+" File found in Aconex")
                            ackversion = r.RegisterSearch.SearchResults[0].Document[0].VersionNumber[0];
                            logger.info("PULL VIEW: "+spFileInfo.Name+" Aconex Version No.: "+ ackversion)
                            if(parseInt(ackversion) > acxversioninSP){
                                logger.info("PULL VIEW: "+spFileInfo.Name+" can be pulled from Aconex.")
                                action = DocumentPullActions.EXISTS
                                message = Messages.PULL
                            }else{
                                logger.info("PULL VIEW: "+spFileInfo.Name+" is already up to date in Aconex.")
                                action = DocumentPullActions.UPDATED,
                                message = Messages.UPDATED
                            }
                        }
                        else
                        {
                            logger.info("PULL VIEW: "+spFileInfo.Name+" does not exists on Aconex.")
                            ackversion = ''
                            action= DocumentPullActions.NOTEXISTS
                            message = Messages.NOTAVAILABLE
                        }
                    }
                    else
                    {
                        logger.info("PULL VIEW: "+spFileInfo.Name+" does not exists on Aconex.")
                        action= DocumentPullActions.NOTEXISTS
                        message = Messages.DOCNOREQUIRED
                    }
                    let viewDetails: DocumentPullDetails = {documentNo: documentNo,revision: metadata.Revision,spVersion: acxversioninSP,ackVersion: ackversion,documentName:spFileInfo.Name,action:action,instance:instanceDetails.InstanceName,projectName: project.ProjectName,project:config.AconexProjectID,site: config.SharepointSite,itemId: Number(spItemId),operation:OperationActions.PULL,message: message,user:user.Title}
                    logger.info("PULL VIEW: "+spFileInfo.Name+" Data to view."+ JSON.stringify(viewDetails))
                    resolve(viewDetails)
                }
                catch(err: any)
                {
                    logger.error(line("PULL VIEW: Failed to get document details ID: "+ spItemId+ " with error: "+err.message))
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
            logger.error("PULL VIEW: Failed to get the Documents: "+ err.message);
            throw new InternalServerError("Failed to get the Documents")
        }
        res.render("pull",{fileDetails: fileDetails})
    }
})

export {router as DocumentPull}