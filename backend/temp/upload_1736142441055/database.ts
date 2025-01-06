import * as mssql  from 'mssql'
import { DatabaseConnectionError } from '../errors/database-connection-error';
import { decryptedPassword } from './password';
import { logger } from '../lib/logger';

class ConnectToDatabase{
    private _pool?: mssql.ConnectionPool
    get pool(){
        return this._pool;
    }
    async connect(){
        try {
            logger.info("Connecting to MSSQL");   
            var config : mssql.config = {
                user: process.env.DB_USER,
                password: decryptedPassword(process.env.DB_PASSWORD),
                server: process.env.DB_HOST || '', 
                database: process.env.DB_NAME, 
                port: parseInt(process.env.DB_PORT!),
                options:{
                    encrypt: false,
                    trustServerCertificate: true
                }
            };
            logger.info("DB Configurations Details "+JSON.stringify(config))
            this._pool  = await new mssql.ConnectionPool(config).connect()
            logger.info("Connected to MSSQL"); 
            return this._pool
        } catch (err:any) {
            logger.info("DB Connection Error: "+err.message)
            throw new DatabaseConnectionError();
        }
    }
}
const dbPool = new ConnectToDatabase();
const DatabaseConnect = async () : Promise<mssql.ConnectionPool | null> => {
    return new Promise<mssql.ConnectionPool | null>((resolve,reject) => { resolve(dbPool.pool!)})
}
export default DatabaseConnect;
export {dbPool}