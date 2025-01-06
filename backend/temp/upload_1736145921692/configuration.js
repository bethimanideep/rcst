"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Configurations = void 0;
const express_1 = __importDefault(require("express"));
const check_auth_1 = require("../middlewares/check-auth");
const database_1 = __importDefault(require("../shared/database"));
const crypto_1 = __importDefault(require("crypto"));
const xml2js_1 = require("xml2js");
const axios_1 = __importDefault(require("axios"));
const internal_server_error_1 = require("../errors/internal-server-error");
const database_connection_error_1 = require("../errors/database-connection-error");
const check_admin_user_1 = require("../middlewares/check-admin-user");
const logger_1 = require("../lib/logger");
const check_controller_user_1 = require("../middlewares/check-controller-user");
const index_1 = require("../index");
const router = express_1.default.Router();
exports.Configurations = router;
router.post("/aconex/configuration/profiles", check_auth_1.checkAuth, check_admin_user_1.checkAdminUser, async (req, res) => {
    logger_1.logger.info("ROUTE :: CONFIGURATION/PROFILES");
    res.render("profiles", { profiles: [] });
});
router.post("/aconex/configuration/profiles/get", check_auth_1.checkAuthFromCookie, check_admin_user_1.checkAdminUser, async (req, res) => {
    logger_1.logger.info("ROUTE :: CONFIGURATION/PROFILES/GET");
    logger_1.logger.info("User trying to access Configuration Profiles page");
    const mssql = await (0, database_1.default)();
    if (mssql) {
        try {
            const columns = [
                "SiteProfileName",
                "SharepointSite",
                "SharepointSiteLibrary",
                "AconexInstanceURL",
                "InstanceName",
                "ProjectName"
            ];
            logger_1.logger.info("Selecting all the profiles from Database");
            let configurationQuery = `select * from SiteProfileSettings as SPS inner join AconexInstanceCredentials as ACI on ACI.AconexURL = SPS.AconexInstanceURL and ACI.InstanceName = SPS.AconexInstanceName inner join AconexProjects as AP on AP.AconexURL = SPS.AconexInstanceURL and AP.ProjectID = SPS.AconexProjectID and AP.InstanceName = SPS.AconexInstanceName`;
            logger_1.logger.info("CONFIGURATIONS QUERY = " + configurationQuery);
            logger_1.logger.info("Counting Profile Configurations");
            let configurationCountQuery = `select count(*) as count from SiteProfileSettings as SPS inner join AconexInstanceCredentials as ACI on ACI.AconexURL = SPS.AconexInstanceURL and ACI.InstanceName = SPS.AconexInstanceName inner join AconexProjects as AP on AP.AconexURL = SPS.AconexInstanceURL and AP.ProjectID = SPS.AconexProjectID and AP.InstanceName = SPS.AconexInstanceName`;
            logger_1.logger.info("CONFIGURATIONS COUNT QUERY = " + configurationCountQuery);
            let configurationCount = await mssql.query(configurationCountQuery);
            let totalCount = 0;
            if (configurationCount.recordsets.length == 1 && configurationCount.recordsets[0] && configurationCount.recordsets[0][0]) {
                totalCount = configurationCount.recordsets[0][0].count;
            }
            if (req.body['search[value]'] && req.body['search[value]'].trim().length > 0) {
                let search = req.body['search[value]'];
                configurationCountQuery += ` AND ( SiteProfileName LIKE '%${search}%' `;
                configurationCountQuery += ` OR  SharepointSite LIKE '%${search}%' `;
                configurationCountQuery += ` OR  SharepointSiteLibrary LIKE '%${search}%' `;
                configurationCountQuery += ` OR  AconexInstanceURL LIKE '%${search}%' `;
                configurationCountQuery += ` OR  InstanceName LIKE '%${search}%' `;
                configurationCountQuery += ` OR  ProjectName LIKE '%${search}%' )`;
                configurationQuery += ` AND ( SiteProfileName LIKE '%${search}%' `;
                configurationQuery += ` OR  SharepointSite LIKE '%${search}%' `;
                configurationQuery += ` OR  SharepointSiteLibrary LIKE '%${search}%' `;
                configurationQuery += ` OR  AconexInstanceURL LIKE '%${search}%' `;
                configurationQuery += ` OR  InstanceName LIKE '%${search}%' `;
                configurationQuery += ` OR  ProjectName LIKE '%${search}%' )`;
            }
            logger_1.logger.info("Loading Configurations count based on Search Values");
            logger_1.logger.info(configurationCountQuery);
            configurationCount = await mssql.query(configurationCountQuery);
            let totalFiltered = 0;
            if (configurationCount.recordsets.length == 1 && configurationCount.recordsets[0] && configurationCount.recordsets[0][0]) {
                totalFiltered = configurationCount.recordsets[0][0].count;
            }
            if (req.body['order[0][column]'] && req.body['order[0][dir]']) {
                configurationQuery += ` ORDER BY ${columns[req.body['order[0][column]']]} ${req.body['order[0][dir]']}`;
            }
            if (req.body['start'] && req.body['length']) {
                configurationQuery += ` OFFSET ${req.body['start']} ROWS FETCH NEXT ${req.body['length']} ROWS ONLY`;
            }
            logger_1.logger.info("Loading Configurations based on Search Values");
            logger_1.logger.info(configurationQuery);
            let configurationRequest = await mssql.query(configurationQuery);
            let configurations = configurationRequest.recordset;
            let cnt = 1;
            let configurationData = [];
            logger_1.logger.info("Fetching Profile Configurations Details");
            for (let c of configurations) {
                let docTransaction = [];
                docTransaction.push(cnt);
                docTransaction.push(c.SiteProfileName);
                docTransaction.push(c.SharepointSite);
                docTransaction.push(c.SharepointSiteLibrary);
                docTransaction.push(c.AconexInstanceURL);
                docTransaction.push(c.AconexInstanceName);
                docTransaction.push(c.ProjectName);
                docTransaction.push(`<button onclick="deleteDetails('${c.SharepointSite}','${c.SharepointSiteLibrary}','${c.AconexInstanceURL}','${c.AconexInstanceName}','${c.AconexProjectID}')" class="btn btn-danger">Delete</button>`);
                configurationData.push(docTransaction);
                cnt++;
            }
            logger_1.logger.info("User has accessed Configuration Profiles page");
            res.status(200).send({
                "draw": req.body.draw,
                "recordsTotal": totalCount,
                "recordsFiltered": totalFiltered,
                "data": configurationData
            });
        }
        catch (err) {
            logger_1.logger.error((0, index_1.line)(err.message));
            throw new database_connection_error_1.DatabaseConnectionError();
        }
    }
});
router.post("/aconex/configuration", check_auth_1.checkAuth, check_controller_user_1.checkControllerUser, async (req, res) => {
    logger_1.logger.info("ROUTE :: CONFIGURATION");
    logger_1.logger.info("User trying to access Site Profile Configuration page");
    const mssql = await (0, database_1.default)();
    if (mssql) {
        const userSP = req.userSP;
        const user = req.user;
        const libraryid = req.query && req.query.sListId ? req.query.sListId.toString() : '';
        let sites;
        let libraryname;
        let aconex_urls;
        logger_1.logger.info("User fetching Sharepoint Site Title and Library Name");
        const siteTitle = req.body.SPSiteTitle;
        logger_1.logger.info("Sharepoint Site name : " + siteTitle);
        try {
            libraryname = (await userSP.web.lists.getById(libraryid).select("Title")()).Title;
            logger_1.logger.info("Library Name : " + libraryname);
            // const sitename = await userSP.search({
            // 	Querytext: "contentclass:STS_Site",
            // 	SelectProperties: ["Title", "SPSiteUrl", "WebTemplate"],
            // 	RowLimit: 500,
            // 	TrimDuplicates: false,
            // 	}).then((r: SearchResults) => {
            // 		// console.log(r.PrimarySearchResults)
            // 	sites = r.PrimarySearchResults;
            // });
            sites = [
                {
                    Title: siteTitle,
                    SPSiteUrl: req.body.SPSiteUrl
                }
            ];
        }
        catch (error) {
            logger_1.logger.error((0, index_1.line)(error.message));
            throw new internal_server_error_1.InternalServerError(error);
        }
        logger_1.logger.info("User has accessed Site Configuration Page of Library: " + `${libraryname}` + " and Sharepoint Site: " + `${siteTitle}`);
        try {
            logger_1.logger.info("User fetching Aconex URLs from Database");
            logger_1.logger.info("XXXXXX");
            let result3 = await mssql.query("select AconexURL, InstanceName from AconexInstanceCredentials WHERE Status=1");
            if (result3) {
                aconex_urls = result3.recordset;
            }
            // let result3 = await mssql.query("select AconexURL from AconexInstanceCredentials WHERE Status=1");	
            // if(result3)
            // {
            // 	aconex_urls = result3.recordset;
            // }
            logger_1.logger.info("ACONEX URLs : " + JSON.stringify(aconex_urls));
        }
        catch (error) {
            logger_1.logger.error((0, index_1.line)(error.message));
            throw new database_connection_error_1.DatabaseConnectionError();
        }
        const config = {
            ProjectId: "",
            Metadata: [],
            UserName: "",
            Password: "",
            InstanceURL: "",
            DocumentLibrary: ""
        };
        res.render("configuration", Object.assign(Object.assign({}, config), { sites, aconex_urls, libraryname, siteTitle }));
    }
});
router.get("/aconex/configuration/data", check_auth_1.checkAuthFromCookie, check_controller_user_1.checkControllerUser, async (req, res) => {
    logger_1.logger.info("ROUTE :: CONFIGURATION/DATA");
    const mssql = await (0, database_1.default)();
    if (mssql) {
        const SPToken = req.cookies.SPAppToken;
        const SPSite = req.cookies.SPSiteUrl;
        const libraryid = req.cookies.SiteLibrary;
        const userSP = req.userSP;
        let spsite;
        let lib;
        let aconexpairs = {};
        let metapairs = {};
        let metadata;
        let metadatasize;
        let aconex_attributes = "";
        let aconex_projects = "";
        let existing_config = "";
        logger_1.logger.info("Getting data needed for Site Configuration");
        try {
            lib = (await userSP.web.lists.getById(libraryid).select("Title")()).Title;
            const sitename = await userSP.search({
                Querytext: "contentclass:STS_Site",
                SelectProperties: ["Title", "SPSiteUrl", "WebTemplate"],
                RowLimit: 500,
                TrimDuplicates: false,
            }).then((r) => {
                spsite = r.PrimarySearchResults;
            });
            logger_1.logger.info("Getting Sharepoint Metadata");
            metadata = await userSP.web.lists.getById(libraryid).fields.filter("(Hidden eq false)").select("InternalName", "Title").get();
            metadatasize = metadata.length;
            for (let j = 0; j < metadatasize; j++) {
                let a = metadata[j].InternalName;
                let b = metadata[j].Title;
                metapairs[a] = b;
            }
            logger_1.logger.info("Metadata Pairs : " + JSON.stringify(metapairs));
        }
        catch (error) {
            logger_1.logger.error((0, index_1.line)(error.message));
            throw new internal_server_error_1.InternalServerError(error);
        }
        try {
            logger_1.logger.info("Getting Aconex Projects");
            logger_1.logger.info("select AconexURL,ProjectName,ProjectID,InstanceName from AconexProjects");
            let result1 = await mssql.query("select AconexURL,ProjectName,ProjectID,InstanceName from AconexProjects");
            if (result1.recordset.length > 0) {
                aconex_projects = result1.recordset;
                let projects_size = result1.rowsAffected[0];
            }
            logger_1.logger.info("ACONEX PROJECTS = " + JSON.stringify(aconex_projects));
            logger_1.logger.info("Getting Aconex Attributes data from Database");
            logger_1.logger.info("select CreateIdentifier,DisplayLabel from AconexAttributes");
            let result2 = await mssql.query("select CreateIdentifier,DisplayLabel from AconexAttributes");
            if (result2.recordset.length > 0) {
                aconex_attributes = result2.recordset;
                let attributes_size = result2.rowsAffected[0];
            }
            logger_1.logger.info("ACONEX ATTRIBUTES = " + JSON.stringify(aconex_attributes));
            logger_1.logger.info("Getting Existing Configuration, if any");
            logger_1.logger.info(`select * from SiteProfileSettings WHERE SharepointSite = '${SPSite}' AND SharepointSiteLibrary = '${lib}'`);
            let result3 = await mssql.query(`select * from SiteProfileSettings WHERE SharepointSite = '${SPSite}' AND SharepointSiteLibrary = '${lib}'`);
            if (result3.recordset.length > 0) {
                existing_config = result3.recordset[0];
            }
            logger_1.logger.info("EXISTING CONFIG = " + JSON.stringify(existing_config));
            logger_1.logger.info("Getting Aconex Metadata");
            for (let i = 0; i < aconex_attributes.length; i++) {
                let m = aconex_attributes[i].CreateIdentifier;
                let n = aconex_attributes[i].DisplayLabel;
                aconexpairs[m] = n;
            }
            logger_1.logger.info("Aconex Metadata : " + JSON.stringify(aconexpairs));
        }
        catch (error) {
            logger_1.logger.error((0, index_1.line)(error.message));
            throw new database_connection_error_1.DatabaseConnectionError();
        }
        return res.send({ spmetakeypairs: metapairs, acxattributes: aconexpairs, acxprojects: aconex_projects, old_config: existing_config });
    }
});
router.post("/aconex/configuration/data/delete", check_auth_1.checkAuthFromCookie, check_admin_user_1.checkAdminUser, async (req, res) => {
    logger_1.logger.info("ROUTE :: CONFIGURATION/DATA/DELETE");
    let response;
    let primarykey = req.body;
    let spsiteurl = primarykey.spsite;
    let spsitelibrary = primarykey.splibrary;
    let aconexurl = primarykey.acxurl;
    let acxprojectid = primarykey.projectid;
    let acxinstance = primarykey.acxinstance;
    let user = req.user;
    logger_1.logger.info("User trying to delete Site Profile Configuration");
    const mssql = await (0, database_1.default)();
    if (mssql) {
        try {
            // let delete_acx_projects =  await mssql.query(`DELETE FROM AconexProjects WHERE AconexURL='${aconexurl}' AND ProjectID = '${acxprojectid}' AND InstanceName = ${acxinstance}`);
            // let delete_acx_attributes =  await mssql.query(`DELETE FROM AttributeMapping WHERE AconexURL = '${aconexurl}' AND ProjectID = '${acxprojectid}'`);
            logger_1.logger.info("Deleting Site Configuration Data of SPSite: " + `${spsiteurl}` + " and Library: " + `${spsitelibrary} + " and Aconex URL: " + ${aconexurl} + " and Instance : " + ${acxinstance} `);
            logger_1.logger.info(`DELETE FROM SiteProfileSettings WHERE SharepointSite ='${spsiteurl}' AND SharepointSiteLibrary = '${spsitelibrary}' AND AconexInstanceURL = '${aconexurl}' AND AconexInstanceName = '${acxinstance}'`);
            let delete_profile_config = await mssql.query(`DELETE FROM SiteProfileSettings WHERE SharepointSite ='${spsiteurl}' AND SharepointSiteLibrary = '${spsitelibrary}' AND AconexInstanceURL = '${aconexurl}' AND AconexInstanceName = '${acxinstance}'`);
            logger_1.logger.info("User has deleted Site Configuration Data of SPSite: " + `${spsiteurl}` + "and Library: " + `${spsitelibrary} + " and Aconex URL: " + ${aconexurl} + " and Instance : " + ${acxinstance}`);
            return res.send({ "message": "Success" });
        }
        catch (error) {
            logger_1.logger.error((0, index_1.line)(error.message));
            res.send({ "message": "Error" });
            throw new database_connection_error_1.DatabaseConnectionError();
        }
    }
});
router.post("/aconex/credentials/data", check_auth_1.checkAuth, check_admin_user_1.checkAdminUser, async (req, res) => {
    logger_1.logger.info("ROUTE :: CREDENTIALS/DATA");
    logger_1.logger.info("User trying to access Aconex Instances page");
    const mssql = await (0, database_1.default)();
    if (mssql) {
        const SPToken = req.body.SPAppToken;
        const SPSite = req.body.SPSiteUrl;
        const spItemId = Number(req.body.SPItemId);
        const userSP = req.userSP;
        const user = req.user;
        const libraryid = req.query && req.query.sListId ? req.query.sListId.toString() : '';
        let response;
        let instances;
        let credentials;
        try {
            logger_1.logger.info("Getting all the Aconex Instances from Database");
            logger_1.logger.info("select AconexURL,ServiceAccountName,InstanceName,Status from AconexInstanceCredentials");
            let result = await mssql.query("select AconexURL,ServiceAccountName,InstanceName,Status from AconexInstanceCredentials");
            response = result.recordset;
            instances = response.length;
            logger_1.logger.info(JSON.stringify(response));
            logger_1.logger.info("User has accessed Aconex Instances Page");
        }
        catch (error) {
            logger_1.logger.error((0, index_1.line)(error.message));
            throw new database_connection_error_1.DatabaseConnectionError();
        }
        res.render("aconexcredentials", { creds: response });
    }
});
router.post("/aconex/credentials/data/add", check_auth_1.checkAuthFromCookie, check_admin_user_1.checkAdminUser, async (req, res) => {
    logger_1.logger.info("ROUTE :: CREDENTIALS/DATA/ADD");
    logger_1.logger.info("User trying to add or modify Aconex Instance");
    const mssql = await (0, database_1.default)();
    if (mssql) {
        var secret_key = process.env.SECRET_KEY;
        var secret_iv = process.env.SECRET_IV;
        var encryptionMethod = 'AES-256-CBC';
        var key = crypto_1.default.createHash('sha512').update(secret_key, 'utf-8').digest('hex').substr(0, 32);
        var iv = crypto_1.default.createHash('sha512').update(secret_iv, 'utf-8').digest('hex').substr(0, 16);
        function encrypt_string(message, encryptionMethod, secret, iv) {
            var encryptor = crypto_1.default.createCipheriv(encryptionMethod, secret, iv);
            var aes_encrypted = encryptor.update(message, 'utf8', 'base64') + encryptor.final('base64');
            return Buffer.from(aes_encrypted).toString('base64');
        }
        let result_duplicate = null;
        let result_instance = null;
        let result_service = null;
        let newcreds = req.body;
        let url = newcreds.aconexurl;
        let serviceaccount = newcreds.serviceaccountname;
        let acxpassword = newcreds.password;
        let acxinstancename = newcreds.instancename;
        let oldaconexurl = newcreds.oldaconex;
        let oldinstancename = newcreds.oldinstance;
        let user = req.user;
        logger_1.logger.info("Encrypting Password");
        var encrypt_pwd = encrypt_string(acxpassword, encryptionMethod, key, iv);
        logger_1.logger.info("Password Encrypted");
        try {
            logger_1.logger.info(`SELECT * FROM AconexInstanceCredentials WHERE InstanceName='${acxinstancename}'`);
            let sqlresponse_instance = await mssql.query(`SELECT * FROM AconexInstanceCredentials WHERE InstanceName='${acxinstancename}'`);
            logger_1.logger.info(`SELECT * FROM AconexInstanceCredentials WHERE AconexURL='${url}' AND ServiceAccountName='${serviceaccount}'`);
            let sqlresponse_service = await mssql.query(`SELECT * FROM AconexInstanceCredentials WHERE AconexURL='${url}' AND ServiceAccountName='${serviceaccount}'`);
            logger_1.logger.info("INSTANCE RESPONSE LENGTH = " + sqlresponse_instance.recordset.length);
            // same instance
            if (sqlresponse_instance.recordset.length > 0) {
                result_instance = sqlresponse_instance.recordset[0];
                logger_1.logger.info("SQL_RESULT INSTANCE = " + JSON.stringify(result_instance));
                if (result_instance) {
                    logger_1.logger.info(`Instance Name : ${acxinstancename} already exists`);
                    return res.send({ "message": "InstanceExists", "unique": url, "signal": "-1", "servicename": serviceaccount });
                }
            }
            logger_1.logger.info("SERVICE RESPONSE LENGTH = " + sqlresponse_service.recordset.length);
            // same url and service - with password check
            if (sqlresponse_service.recordset.length > 0) {
                result_service = sqlresponse_service.recordset[0];
                logger_1.logger.info("SQL_RESULT SERVICE = " + JSON.stringify(result_service));
                if (result_service) {
                    if (result_service.Password == encrypt_pwd) {
                        logger_1.logger.info(`Instance with Aconex URL : ${url} and Service Account Name : ${serviceaccount} already exists`);
                        return res.send({ "message": "ServiceAccountExists", "unique": url, "signal": "-1", "servicename": serviceaccount });
                    }
                }
            }
            const projectsresponse = await axios_1.default.get(`${url}/api/projects`, {
                auth: {
                    username: serviceaccount,
                    password: acxpassword
                }
            }).catch(function (error) {
                return error.response;
            });
            logger_1.logger.info("Authenticating Username and Password");
            logger_1.logger.info(projectsresponse.status);
            if (projectsresponse.status == 200) // Verified Successfully
             {
                logger_1.logger.info("Credentials verified Successfully");
                logger_1.logger.info("CHECKING IF THE SERVICE ACCOUNT ALREADY EXIST");
                if (!result_service) {
                    logger_1.logger.info("Creating the New Instance");
                    try {
                        const count = projectsresponse.data.totalResultsCount;
                        const projects = projectsresponse.data.searchResults;
                        logger_1.logger.info("Adding all the projects related to the Aconex Instance");
                        //Change logic below
                        var sql = `INSERT into AconexProjects (AconexURL, ProjectName, ProjectID, InstanceName) VALUES`;
                        let projectdetails = [];
                        //
                        for (let v = 0; v < count; v++) {
                            projectdetails[v] = {
                                AconexURL: url,
                                ProjectName: projects[v].projectName,
                                ProjectID: projects[v].projectID,
                                InstanceName: acxinstancename
                            };
                            sql += `(` + `'${projectdetails[v].AconexURL}', '${projectdetails[v].ProjectName}', '${projectdetails[v].ProjectID}', '${projectdetails[v].InstanceName}'` + `),`;
                        }
                        sql = sql.substr(0, sql.length - 1);
                        var encryptedPassword = encrypt_pwd;
                        logger_1.logger.info(sql);
                        let result_projects = await mssql.query(sql);
                        logger_1.logger.info(JSON.stringify(result_projects));
                        logger_1.logger.info("Added all projects in the Database");
                        logger_1.logger.info("Adding new Instance Credentials in Database");
                        logger_1.logger.info(`INSERT into AconexInstanceCredentials (AconexURL, InstanceName, ServiceAccountName, Password, Status) VALUES ('${url}', '${acxinstancename}', '${serviceaccount}', '${encryptedPassword}','1')`);
                        let result_creds = await mssql.query(`INSERT into AconexInstanceCredentials (AconexURL, InstanceName, ServiceAccountName, Password, Status) VALUES ('${url}', '${acxinstancename}', '${serviceaccount}', '${encryptedPassword}','1')`);
                        logger_1.logger.info(JSON.stringify(result_creds));
                        logger_1.logger.info("User has Added new Aconex Instance with URL: " + `${url}` + " and Service Account " + `${serviceaccount}`);
                        return res.send({ "message": "Created", "unique": url, "signal": "0", "servicename": serviceaccount });
                    }
                    catch (error) {
                        logger_1.logger.error((0, index_1.line)(error.message));
                        res.send({ "message": "Create Error", "unique": "" });
                        throw new database_connection_error_1.DatabaseConnectionError();
                    }
                }
                else {
                    try {
                        logger_1.logger.info("OLD URL : " + oldaconexurl + " - OLD INSTANCE : " + oldinstancename);
                        if (!oldinstancename) {
                            oldinstancename = result_service.InstanceName;
                            logger_1.logger.info("OLD INSTANCE RRR : " + oldinstancename);
                        }
                        logger_1.logger.info("Instance already available. Updating the current Instance");
                        const count = projectsresponse.data.totalResultsCount;
                        const projects = projectsresponse.data.searchResults;
                        logger_1.logger.info("Updating all the projects, deleting old projects");
                        // test below line - 1
                        logger_1.logger.info(`DELETE FROM AconexProjects WHERE AconexURL IN ('${oldaconexurl}', '${url}') AND InstanceName = '${oldinstancename}'`);
                        let delete_old_projects = await mssql.query(`DELETE FROM AconexProjects WHERE AconexURL IN ('${oldaconexurl}', '${url}') AND InstanceName = '${oldinstancename}'`);
                        logger_1.logger.info(JSON.stringify(delete_old_projects));
                        logger_1.logger.info("Old Projects deleted");
                        logger_1.logger.info("Adding new projects");
                        var sql = `INSERT into AconexProjects (AconexURL, ProjectName, ProjectID, InstanceName) VALUES`;
                        let projectdetails = [];
                        for (let v = 0; v < count; v++) {
                            projectdetails[v] = {
                                AconexURL: url,
                                ProjectName: projects[v].projectName,
                                ProjectID: projects[v].projectID,
                                InstanceName: acxinstancename
                            };
                            sql += `(` + `'${projectdetails[v].AconexURL}', '${projectdetails[v].ProjectName}', '${projectdetails[v].ProjectID}', '${projectdetails[v].InstanceName}'` + `),`;
                        }
                        sql = sql.substr(0, sql.length - 1);
                        var encryptedPassword = encrypt_pwd;
                        logger_1.logger.info(sql);
                        let result_projects = await mssql.query(sql);
                        logger_1.logger.info(JSON.stringify(result_projects));
                        logger_1.logger.info("New projects added. Updated all the projects");
                        logger_1.logger.info("Updating instance Credentials");
                        // test below line - 2
                        let result_creds = await mssql.query(`UPDATE AconexInstanceCredentials SET AconexURL = '${url}',InstanceName = '${acxinstancename}', ServiceAccountName = '${serviceaccount}', Password = '${encryptedPassword}' WHERE AconexURL = '${url}' AND InstanceName = '${oldinstancename}'`);
                        logger_1.logger.info(JSON.stringify(result_creds));
                        logger_1.logger.info("User has updated new Aconex Instance of URL: " + `${url}` + " and Service Account " + `${serviceaccount}`);
                        logger_1.logger.info("Checking if the Instance is Disabled or Enabled...");
                        logger_1.logger.info(`SELECT Status from AconexInstanceCredentials WHERE AconexURL = '${url}'`);
                        let is_disabled = await mssql.query(`SELECT Status from AconexInstanceCredentials WHERE AconexURL = '${url}' AND ServiceAccountName = '${serviceaccount}'`);
                        logger_1.logger.info("Status : " + is_disabled.recordset[0].Status);
                        if (is_disabled.recordset[0].Status == 1) {
                            logger_1.logger.info("Instance is Enabled");
                            return res.send({ "message": "Updated", "unique": url, "signal": "0", "servicename": serviceaccount });
                        }
                        else {
                            logger_1.logger.info("Instance is Disabled");
                            return res.send({ "message": "Updated", "unique": url, "signal": "1", "servicename": serviceaccount });
                        }
                    }
                    catch (error) {
                        logger_1.logger.error((0, index_1.line)(error.message));
                        res.send({ "message": "Update Error", "unique": "" });
                        throw new database_connection_error_1.DatabaseConnectionError();
                    }
                }
            }
            else {
                logger_1.logger.info("Not Authenticated : User tried to add or modify new Aconex Instance using wrong credentials with URL: " + `${url} and failed`);
                return res.send({ "message": "IncorrectCredentials", "unique": url, "signal": "2", "servicename": serviceaccount });
            }
        }
        catch (error) {
            logger_1.logger.error((0, index_1.line)(error.message));
            res.send({ "message": "DatabaseError", "unique": url, "signal": "2" });
            throw new database_connection_error_1.DatabaseConnectionError();
        }
    }
});
router.post("/aconex/credentials/data/delete", check_auth_1.checkAuthFromCookie, check_admin_user_1.checkAdminUser, async (req, res) => {
    logger_1.logger.info("ROUTE :: CREDENTIALS/DATA/DELETE");
    let response;
    let primarykey = req.body;
    let url = primarykey.aconexurl;
    let aconexinstance = primarykey.aconexinstance;
    let status = primarykey.status;
    let user = req.user;
    if (status == 1)
        logger_1.logger.info("User trying to enable an Aconex Instance");
    else
        logger_1.logger.info("User trying to disable an Aconex Instance");
    const mssql = await (0, database_1.default)();
    if (mssql) {
        try {
            if (status == 1) {
                logger_1.logger.info("Enabling the Instance");
                logger_1.logger.info(`UPDATE AconexInstanceCredentials SET Status='${status}' WHERE AconexURL='${url}' AND InstanceName = '${aconexinstance}'`);
                let delete_acx_credentials = await mssql.query(`UPDATE AconexInstanceCredentials SET Status='${status}' WHERE AconexURL='${url}' AND InstanceName = '${aconexinstance}'`);
                logger_1.logger.info(JSON.stringify(delete_acx_credentials));
                logger_1.logger.info("User has Enabled Aconex Instance with URL :" + `${url}`);
            }
            else {
                logger_1.logger.info("Disabling the Instance");
                logger_1.logger.info(`UPDATE AconexInstanceCredentials SET Status='${status}' WHERE AconexURL='${url}' AND InstanceName = '${aconexinstance}'`);
                let delete_acx_credentials = await mssql.query(`UPDATE AconexInstanceCredentials SET Status='${status}' WHERE AconexURL='${url}' AND InstanceName = '${aconexinstance}'`);
                logger_1.logger.info(JSON.stringify(delete_acx_credentials));
                logger_1.logger.info("User has disabled Aconex Instance with URL :" + `${url}`);
            }
            // let delete_acx_projects =  await mssql.query(`DELETE FROM AconexProjects WHERE AconexURL='${url}'`);
            // let delete_acx_attributes =  await mssql.query(`DELETE FROM AttributeMapping WHERE AconexURL='${url}'`);
            //create an alert here if we want to delete  profile config related to ACXURL
            // let delete_profile_config =  await mssql.query(`UPDATE SiteProfileSettings SET Status=0 WHERE AconexInstanceURL='${url}'`);
            return res.send({ "message": "Success" });
        }
        catch (error) {
            logger_1.logger.error((0, index_1.line)(error.message));
            res.send({ "message": "Error" });
            throw new database_connection_error_1.DatabaseConnectionError();
        }
    }
});
router.post("/save/configuration", check_auth_1.checkAuthFromCookie, check_controller_user_1.checkControllerUser, async (req, res) => {
    logger_1.logger.info("ROUTE :: SAVE/CONFIGURATION");
    logger_1.logger.info("User trying to Save Site Profile Configuration");
    const mssql = await (0, database_1.default)();
    if (mssql) {
        const user = req.cookies.user;
        const response = req.body;
        const siteprofile = response.SiteProfileName;
        const spsite = response.SharepointSite;
        const spsitelibrary = response.SharepointSiteLibrary;
        const acxurl = response.AconexInstanceURL;
        const acxprojectid = response.AconexProjectID;
        const acxshortname = response.ProjectShortName;
        const acxinstancename = response.AconexInstanceName;
        const metamapping = JSON.stringify(response.MetadataMapping);
        var secret_key = process.env.SECRET_KEY;
        var secret_iv = process.env.SECRET_IV;
        var encryptionMethod = 'AES-256-CBC';
        var key = crypto_1.default.createHash('sha512').update(secret_key, 'utf-8').digest('hex').substr(0, 32);
        var iv = crypto_1.default.createHash('sha512').update(secret_iv, 'utf-8').digest('hex').substr(0, 16);
        function decrypt_string(encryptedMessage, encryptionMethod, secret, iv) {
            const buff = Buffer.from(encryptedMessage, 'base64');
            encryptedMessage = buff.toString('utf-8');
            var decyptor = crypto_1.default.createDecipheriv(encryptionMethod, secret, iv);
            return decyptor.update(encryptedMessage, 'base64', 'utf-8') + decyptor.final('utf-8');
        }
        let credentials = undefined;
        let servicepassword = undefined;
        let serviceusername = undefined;
        var decryptedPassword = undefined;
        // let acxinstancename: any = undefined;
        let response_data;
        let result = "";
        try {
            logger_1.logger.info(`Getting Credentials data of ${acxurl} and ${acxinstancename} from Database`);
            logger_1.logger.info(`SELECT ServiceAccountName, Password, InstanceName from AconexInstanceCredentials WHERE AconexURL='${acxurl}' AND InstanceName='${acxinstancename}'`);
            credentials = await mssql.query(`SELECT ServiceAccountName, Password, InstanceName from AconexInstanceCredentials WHERE AconexURL='${acxurl}' AND InstanceName='${acxinstancename}'`);
            if (credentials.recordset.length > 0) {
                serviceusername = credentials.recordset[0].ServiceAccountName;
                servicepassword = credentials.recordset[0].Password;
                // acxinstancename = credentials.recordset[0].InstanceName;
                logger_1.logger.info("Decrypting password");
                decryptedPassword = decrypt_string(servicepassword, encryptionMethod, key, iv);
                logger_1.logger.info("Password Decrypted");
            }
        }
        catch (error) {
            logger_1.logger.error((0, index_1.line)(error.message));
            throw new database_connection_error_1.DatabaseConnectionError();
        }
        const schema_data = await axios_1.default.get(`${acxurl}/api/projects/${acxprojectid}/register/schema`, {
            auth: {
                username: serviceusername,
                password: decryptedPassword
            }
        }).catch(function (error) {
            return error.response;
        });
        try {
            logger_1.logger.info(`Getting Schema data (DocStatus and DocType) from Aconex Project ${acxprojectid}`);
            if (schema_data.status == 200) {
                response_data = (JSON.parse(JSON.stringify(await (0, xml2js_1.parseStringPromise)(schema_data.data)))).RegisterSchema.EntityCreationSchemaFields[0].MultiValueSchemaField;
                // logger.info(JSON.stringify(response_data));
                logger_1.logger.info("Fetched Schema data");
                const size = response_data.length;
                let docstatus;
                let doctype;
                for (let i = 0; i < size; i++) {
                    if (response_data[i].Identifier[0] == 'DocumentStatusId') {
                        docstatus = response_data[i].SchemaValues[0].SchemaValue;
                    }
                    if (response_data[i].Identifier[0] == 'DocumentTypeId') {
                        doctype = response_data[i].SchemaValues[0].SchemaValue;
                    }
                }
                let docstatus_count = docstatus.length;
                let doctype_count = doctype.length;
                var sql_docstatus = `INSERT into AttributeMapping (ProjectID, StringValue, IntegerValue, AconexURL) VALUES`;
                var sql_doctype = `INSERT into AttributeMapping (ProjectID, StringValue, IntegerValue, AconexURL) VALUES`;
                for (let v = 0; v < docstatus_count; v++) {
                    sql_docstatus += `(` + `'${acxprojectid}', '${docstatus[v].Value[0]}', '${docstatus[v].Id[0]}', '${acxurl}'` + `),`;
                }
                sql_docstatus = sql_docstatus.substr(0, sql_docstatus.length - 1);
                for (let v = 0; v < doctype_count; v++) {
                    sql_doctype += `(` + `'${acxprojectid}', '${doctype[v].Value[0]}', '${doctype[v].Id[0]}', '${acxurl}'` + `),`;
                }
                sql_doctype = sql_doctype.substr(0, sql_doctype.length - 1);
                logger_1.logger.info("Checking for old configuration");
                logger_1.logger.info(`SELECT * from SiteProfileSettings  WHERE  SharepointSite='${spsite}' AND SharepointSiteLibrary='${spsitelibrary}'`);
                let old_config_response = await mssql.query(`SELECT * from SiteProfileSettings  WHERE  SharepointSite='${spsite}' AND SharepointSiteLibrary='${spsitelibrary}'`);
                if (old_config_response.recordset.length > 0) {
                    logger_1.logger.info("Old Configuration available");
                    logger_1.logger.info("Getting Old Attributes");
                    let old_attributes_before_update = await mssql.query(`SELECT AconexInstanceURL,AconexProjectID from SiteProfileSettings  WHERE  SharepointSite='${spsite}' AND SharepointSiteLibrary='${spsitelibrary}'`);
                    logger_1.logger.info(JSON.stringify(old_attributes_before_update.recordset[0]));
                    if (old_attributes_before_update.recordset.length > 0) {
                        logger_1.logger.info("Getting Old Aconex URL and Project ID to delete Old Attributes");
                        let oldacxurl = old_attributes_before_update.recordset[0].AconexInstanceURL;
                        let oldacxprojectid = old_attributes_before_update.recordset[0].AconexProjectID;
                        logger_1.logger.info(oldacxurl + "  " + oldacxprojectid);
                        logger_1.logger.info("Deleting old Attributes");
                        logger_1.logger.info(`DELETE from AttributeMapping  WHERE  ProjectID= '${oldacxprojectid}' and AconexURL='${oldacxurl}'`);
                        let delete_old_config_attributes_before_update = await mssql.query(`DELETE from AttributeMapping  WHERE  ProjectID= '${oldacxprojectid}' and AconexURL='${oldacxurl}'`);
                        logger_1.logger.info(JSON.stringify(delete_old_config_attributes_before_update));
                        logger_1.logger.info("Old Attributes deleted");
                    }
                    logger_1.logger.info("Updating the Configuration");
                    logger_1.logger.info(`UPDATE SiteProfileSettings SET SiteProfileName = '${siteprofile}', AconexInstanceURL = '${acxurl}', AconexProjectID = '${acxprojectid}', AconexInstanceName = '${acxinstancename}', MetadataMapping = '${metamapping}' WHERE  SharepointSite='${spsite}' AND SharepointSiteLibrary='${spsitelibrary}'`);
                    let update_old_config = await mssql.query(`UPDATE SiteProfileSettings SET SiteProfileName = '${siteprofile}', AconexInstanceURL = '${acxurl}', AconexProjectID = '${acxprojectid}', AconexInstanceName = '${acxinstancename}', MetadataMapping = '${metamapping}' WHERE  SharepointSite='${spsite}' AND SharepointSiteLibrary='${spsitelibrary}'`);
                    logger_1.logger.info(JSON.stringify(update_old_config));
                }
                else {
                    logger_1.logger.info("Old Configuration not available");
                    logger_1.logger.info("Creating new Configuration");
                    logger_1.logger.info(`INSERT into SiteProfileSettings (SiteProfileName, SharepointSite, SharepointSiteLibrary, AconexInstanceURL, AconexProjectID, AconexInstanceName, MetadataMapping) VALUES ('${siteprofile}', '${spsite}', '${spsitelibrary}', '${acxurl}', '${acxprojectid}', '${acxinstancename}', '${metamapping}')`);
                    let create_new_config = await mssql.query(`INSERT into SiteProfileSettings (SiteProfileName, SharepointSite, SharepointSiteLibrary, AconexInstanceURL, AconexProjectID, AconexInstanceName, MetadataMapping) VALUES ('${siteprofile}', '${spsite}', '${spsitelibrary}', '${acxurl}', '${acxprojectid}', '${acxinstancename}', '${metamapping}')`);
                    logger_1.logger.info(JSON.stringify(create_new_config));
                    logger_1.logger.info("New Configuration created");
                }
                logger_1.logger.info('Removing previous Attributes');
                logger_1.logger.info(`DELETE from AttributeMapping WHERE ProjectID= '${acxprojectid}' AND AconexURL='${acxurl}'`);
                let remove_previous_attributes = await mssql.query(`DELETE from AttributeMapping WHERE ProjectID= '${acxprojectid}' AND AconexURL='${acxurl}'`);
                logger_1.logger.info(JSON.stringify(remove_previous_attributes));
                logger_1.logger.info("Adding latest attributes into Database");
                logger_1.logger.info("Attributes - DocStatus : [" + sql_docstatus + "]");
                let docstatus_attribute_mapping_response = await mssql.query(sql_docstatus);
                logger_1.logger.info(JSON.stringify(docstatus_attribute_mapping_response));
                logger_1.logger.info("Attributes - DocType : [" + sql_doctype + "]");
                let doctype_attribute_mapping_response = await mssql.query(sql_doctype);
                logger_1.logger.info(JSON.stringify(doctype_attribute_mapping_response));
                logger_1.logger.info("User has saved a site profile with profile name: " + `${siteprofile}` + " for Sharepoint site: " + `${spsite}` + " and Library: " + `${spsitelibrary}`);
                return res.send({ "message": "Successful" });
            }
            else {
                logger_1.logger.info("User has tried saving new Site Configuration for Sharepoint site: " + `${spsite}` + " and Library: " + `${spsitelibrary}` + " but not successful");
                return res.send({ "message": "Not Successful" });
            }
        }
        catch (error) {
            logger_1.logger.error((0, index_1.line)(error.message));
            res.send({ "message": "Error" });
            throw new database_connection_error_1.DatabaseConnectionError();
        }
    }
});
