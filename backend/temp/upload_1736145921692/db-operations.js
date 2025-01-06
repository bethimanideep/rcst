"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSPSiteConfigProfiles = exports.getAconexAttributesMapping = exports.getAconexAttributes = exports.getAconexProjectDetails = exports.getAconexInstanceDetails = exports.getSiteProfileSetting = void 0;
const internal_server_error_1 = require("../errors/internal-server-error");
const logger_1 = require("../lib/logger");
const types_1 = require("../types/types");
const getSiteProfileSetting = async (mssql, SPSite, library) => {
    let config;
    try {
        logger_1.logger.info("Accessing Site Profile Setting - SPSite: " + SPSite);
        logger_1.logger.info("Accessing Site Profile Setting - Site Library: " + library);
        logger_1.logger.info("Accessing Site Profile Setting - Query: " + `select * from SiteProfileSettings where SharepointSite='${SPSite}' and SharepointSiteLibrary='${library}'`);
        let configRes = await mssql.query(`select * from SiteProfileSettings where SharepointSite='${SPSite}' and SharepointSiteLibrary='${library}'`);
        if (configRes.recordset.length == 1) {
            config = configRes.recordset[0];
        }
        if (!config) {
            logger_1.logger.info("Site Configuration not found");
            throw new internal_server_error_1.InternalServerError(types_1.Messages.CONFIG_NOT_FOUND);
        }
    }
    catch (err) {
        logger_1.logger.error("Site Configuration not found: " + err.message);
        throw new internal_server_error_1.InternalServerError(types_1.Messages.CONFIG_NOT_FOUND);
    }
    return config;
};
exports.getSiteProfileSetting = getSiteProfileSetting;
const getAconexInstanceDetails = async (mssql, AconexInstanceURL, AconexInstanceName) => {
    let instanceDetails;
    try {
        logger_1.logger.info("Accessing Aconex Instance - Aconex Instance URL and Instance Name : " + AconexInstanceURL + " " + AconexInstanceName);
        logger_1.logger.info("Accessing Aconex Instance - Query: " + `select * from AconexInstanceCredentials where AconexURL='${AconexInstanceURL}' AND InstanceName='${AconexInstanceName}'`);
        let instanceRes = await mssql.query(`select * from AconexInstanceCredentials where AconexURL='${AconexInstanceURL}' AND InstanceName='${AconexInstanceName}'`);
        if (instanceRes.recordset.length == 1) {
            instanceDetails = instanceRes.recordset[0];
        }
        if (!instanceDetails) {
            logger_1.logger.info("Aconex Instance not found");
            throw new internal_server_error_1.InternalServerError(types_1.Messages.INSTANCE_NOT_FOUND);
        }
    }
    catch (err) {
        logger_1.logger.error("Aconex Instance not found: " + err.message);
        throw new internal_server_error_1.InternalServerError(types_1.Messages.INSTANCE_NOT_FOUND);
    }
    if (instanceDetails.Status !== 1) {
        logger_1.logger.info("Aconex Instance is disabled");
        throw new internal_server_error_1.InternalServerError(types_1.Messages.INSTANCE_DISABLED);
    }
    return instanceDetails;
};
exports.getAconexInstanceDetails = getAconexInstanceDetails;
const getAconexProjectDetails = async (mssql, AconexInstanceURL, AconexProjectID, AconexInstanceName) => {
    let project;
    try {
        logger_1.logger.info("Accessing Aconex Project - Aconex Instance URL and Instance Name : " + AconexInstanceURL + " " + AconexInstanceName);
        logger_1.logger.info("Accessing Aconex Project - Aconex Project ID: " + AconexProjectID);
        logger_1.logger.info("Accessing Aconex Project - Query: " + `select * from AconexProjects where AconexURL='${AconexInstanceURL}' and ProjectID='${AconexProjectID}' and InstanceName = '${AconexInstanceName}'`);
        let projectRes = await mssql.query(`select * from AconexProjects where AconexURL='${AconexInstanceURL}' and ProjectID='${AconexProjectID}' and InstanceName = '${AconexInstanceName}'`);
        if (projectRes.recordset.length == 1) {
            project = projectRes.recordset[0];
        }
        if (!project) {
            logger_1.logger.info("Aconex Project not found");
            throw new internal_server_error_1.InternalServerError(types_1.Messages.PROJECT_NOT_FOUND);
        }
    }
    catch (err) {
        logger_1.logger.error("Aconex Project not found: " + err.message);
        throw new internal_server_error_1.InternalServerError(types_1.Messages.PROJECT_NOT_FOUND);
    }
    return project;
};
exports.getAconexProjectDetails = getAconexProjectDetails;
const getAconexAttributes = async (mssql) => {
    let aconexAttributes;
    try {
        logger_1.logger.info("Accessing Aconex Attributes - Query: " + `select * from AconexAttributes`);
        let attributesRes = await mssql.query(`select * from AconexAttributes`);
        aconexAttributes = attributesRes.recordset;
        if (aconexAttributes.length == 0) {
            throw new internal_server_error_1.InternalServerError(types_1.Messages.COMMON);
        }
    }
    catch (err) {
        logger_1.logger.error("Error getting Aconex Attributes " + err.message);
        throw new internal_server_error_1.InternalServerError(types_1.Messages.COMMON);
    }
    return aconexAttributes;
};
exports.getAconexAttributes = getAconexAttributes;
const getAconexAttributesMapping = async (mssql, AconexProjectID) => {
    let attributesMapping;
    try {
        logger_1.logger.info("Accessing Aconex Project Mappings- Aconex Project ID: " + AconexProjectID);
        logger_1.logger.info("Accessing Aconex Project Mappings- Query: " + `select * from AttributeMapping where ProjectID='${AconexProjectID}'`);
        let attributesMappingRes = await mssql.query(`select * from AttributeMapping where ProjectID='${AconexProjectID}'`);
        attributesMapping = attributesMappingRes.recordset;
        if (attributesMapping.length == 0) {
            throw new internal_server_error_1.InternalServerError(types_1.Messages.COMMON);
        }
    }
    catch (err) {
        logger_1.logger.error("Error getting Aconex Project Mappings " + err.message);
        throw new internal_server_error_1.InternalServerError(types_1.Messages.COMMON);
    }
    return attributesMapping;
};
exports.getAconexAttributesMapping = getAconexAttributesMapping;
const getSPSiteConfigProfiles = async (mssql) => {
    let profiles;
    try {
        // let profilesRes: IResult<SiteProfileSetting> = await mssql.query("select * from SiteProfileSettings as SPS inner join AconexInstanceCredentials as ACI on ACI.AconexURL = SPS.AconexInstanceURL inner join AconexProjects as AP on AP.AconexURL = SPS.AconexInstanceURL and AP.ProjectID = SPS.AconexProjectID")
        // below
        let configurationQuery = "select * from SiteProfileSettings as SPS inner join AconexInstanceCredentials as ACI on ACI.AconexURL = SPS.AconexInstanceURL and ACI.InstanceName = SPS.AconexInstanceName inner join AconexProjects as AP on AP.AconexURL = SPS.AconexInstanceURL and AP.ProjectID = SPS.AconexProjectID and AP.InstanceName = SPS.AconexInstanceName";
        let profilesRes = await mssql.query(configurationQuery);
        profiles = profilesRes.recordset;
    }
    catch (err) {
        throw new internal_server_error_1.InternalServerError(types_1.Messages.COMMON);
    }
    return profiles;
};
exports.getSPSiteConfigProfiles = getSPSiteConfigProfiles;
