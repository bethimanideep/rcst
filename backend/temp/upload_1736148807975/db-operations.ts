import { ConnectionPool, IRecordSet, IResult } from "mssql";
import { InternalServerError } from "../errors/internal-server-error";
import { logger } from "../lib/logger";
import { AconexAttributes, AconexInstanceCredentials, AconexProject, AttributesMapping, Messages, SiteProfileSetting } from "../types/types";
import { line } from "../index";

export const getSiteProfileSetting = async (mssql: ConnectionPool,SPSite: string,library: string): Promise<SiteProfileSetting> => 
{
    let config!: SiteProfileSetting
    try 
    {
        logger.info("Accessing Site Profile Setting - SPSite: " + SPSite)
        logger.info("Accessing Site Profile Setting - Site Library: " + library)
        logger.info("Accessing Site Profile Setting - Query: " + `select * from SiteProfileSettings where SharepointSite='${SPSite}' and SharepointSiteLibrary='${library}'`)
        let configRes: IResult<SiteProfileSetting> = await mssql.query(`select * from SiteProfileSettings where SharepointSite='${SPSite}' and SharepointSiteLibrary='${library}'`)
        if(configRes.recordset.length==1)
        {
            config = configRes.recordset[0]
        }
        
        if(!config){
            logger.info("Site Configuration not found")
            throw new InternalServerError(Messages.CONFIG_NOT_FOUND)
        }
    }catch(err: any){
        logger.error("Site Configuration not found: " + err.message)
        throw new InternalServerError(Messages.CONFIG_NOT_FOUND)
    }
    return config
}

export const getAconexInstanceDetails = async (mssql: ConnectionPool, AconexInstanceURL: string, AconexInstanceName: string): Promise<AconexInstanceCredentials> => 
{
    let instanceDetails!: AconexInstanceCredentials 
    try{
        logger.info("Accessing Aconex Instance - Aconex Instance URL and Instance Name : " + AconexInstanceURL + " " + AconexInstanceName)
        logger.info("Accessing Aconex Instance - Query: "+ `select * from AconexInstanceCredentials where AconexURL='${AconexInstanceURL}' AND InstanceName='${AconexInstanceName}'`)
        let instanceRes:  IResult<AconexInstanceCredentials>= await mssql.query(`select * from AconexInstanceCredentials where AconexURL='${AconexInstanceURL}' AND InstanceName='${AconexInstanceName}'`)
        if(instanceRes.recordset.length==1){
            instanceDetails = instanceRes.recordset[0];
        }
        if(!instanceDetails){
            logger.info("Aconex Instance not found")
            throw new InternalServerError(Messages.INSTANCE_NOT_FOUND)
        }
    }catch(err: any){
        logger.error("Aconex Instance not found: "+err.message)
        throw new InternalServerError(Messages.INSTANCE_NOT_FOUND)
    }
    if(instanceDetails.Status!==1){
        logger.info("Aconex Instance is disabled")
        throw new InternalServerError(Messages.INSTANCE_DISABLED)
    }
    return instanceDetails
}

export const getAconexProjectDetails = async (mssql: ConnectionPool,AconexInstanceURL: string, AconexProjectID: number, AconexInstanceName: string): Promise<AconexProject> => 
{
    let project!: AconexProject
    try
    {
        logger.info("Accessing Aconex Project - Aconex Instance URL and Instance Name : " + AconexInstanceURL + " " + AconexInstanceName)
        logger.info("Accessing Aconex Project - Aconex Project ID: " + AconexProjectID)
        logger.info("Accessing Aconex Project - Query: " + `select * from AconexProjects where AconexURL='${AconexInstanceURL}' and ProjectID='${AconexProjectID}' and InstanceName = '${AconexInstanceName}'`)
        let projectRes:  IResult<AconexProject>= await mssql.query(`select * from AconexProjects where AconexURL='${AconexInstanceURL}' and ProjectID='${AconexProjectID}' and InstanceName = '${AconexInstanceName}'`)
        if(projectRes.recordset.length==1)
        {
            project = projectRes.recordset[0]
        }
        if(!project)
        {
            logger.info("Aconex Project not found")
            throw new InternalServerError(Messages.PROJECT_NOT_FOUND)
        }
    }
    catch(err: any)
    {
        logger.error("Aconex Project not found: "+ err.message)
        throw new InternalServerError(Messages.PROJECT_NOT_FOUND)
    }
    return project;
}

export const getAconexAttributes = async (mssql: ConnectionPool): Promise<AconexAttributes[]> => 
{
    let aconexAttributes!: AconexAttributes[]
    try
    {
        logger.info("Accessing Aconex Attributes - Query: " + `select * from AconexAttributes`)
        let attributesRes: IResult<AconexAttributes> = await mssql.query(`select * from AconexAttributes`)
	    aconexAttributes = attributesRes.recordset
        if(aconexAttributes.length==0)
        {
            throw new InternalServerError(Messages.COMMON)
        }
    }
    catch(err: any)
    {
        logger.error("Error getting Aconex Attributes "+ err.message)
        throw new InternalServerError(Messages.COMMON)
    }
    return aconexAttributes
}

export const getAconexAttributesMapping = async (mssql: ConnectionPool,AconexProjectID: number): Promise<AttributesMapping[]> => 
{
    let attributesMapping!: AttributesMapping[]
    try
    {
        logger.info("Accessing Aconex Project Mappings- Aconex Project ID: " + AconexProjectID)
        logger.info("Accessing Aconex Project Mappings- Query: " + `select * from AttributeMapping where ProjectID='${AconexProjectID}'`)
        let attributesMappingRes: IResult<AttributesMapping> = await mssql.query(`select * from AttributeMapping where ProjectID='${AconexProjectID}'`)
	    attributesMapping = attributesMappingRes.recordset
        if(attributesMapping.length==0)
        {
            throw new InternalServerError(Messages.COMMON)
        }
    }
    catch(err: any)
    {
        logger.error("Error getting Aconex Project Mappings "+ err.message)
        throw new InternalServerError(Messages.COMMON)
    }
    return attributesMapping
}

export const getSPSiteConfigProfiles = async(mssql: ConnectionPool): Promise<SiteProfileSetting[]> => 
{
    let profiles!: SiteProfileSetting[]
    try
    {
        // let profilesRes: IResult<SiteProfileSetting> = await mssql.query("select * from SiteProfileSettings as SPS inner join AconexInstanceCredentials as ACI on ACI.AconexURL = SPS.AconexInstanceURL inner join AconexProjects as AP on AP.AconexURL = SPS.AconexInstanceURL and AP.ProjectID = SPS.AconexProjectID")
        // below
        let configurationQuery = "select * from SiteProfileSettings as SPS inner join AconexInstanceCredentials as ACI on ACI.AconexURL = SPS.AconexInstanceURL and ACI.InstanceName = SPS.AconexInstanceName inner join AconexProjects as AP on AP.AconexURL = SPS.AconexInstanceURL and AP.ProjectID = SPS.AconexProjectID and AP.InstanceName = SPS.AconexInstanceName";
        let profilesRes: IResult<SiteProfileSetting> = await mssql.query(configurationQuery)
        profiles = profilesRes.recordset
    }
    catch(err)
    {
        throw new InternalServerError(Messages.COMMON)
    }
    return profiles
}