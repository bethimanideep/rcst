import { bootstrap } from 'global-agent';
bootstrap()
import { NodeFetchClient, setProxyUrl } from "@pnp/nodejs-commonjs";
import { sp } from "@pnp/sp-commonjs";
import fs from 'fs';
import https from "https";
import express from "express";
import 'express-async-errors'
import path from "path";
import bodyParser from "body-parser";
import * as ejs  from 'ejs'
import * as dotenv from 'dotenv'
import cookieParser from "cookie-parser" 
import { DocumentPush } from "./routes/push";
import { DocumentPull } from "./routes/pull";
import { Transactions } from "./routes/transactions";
import { Configurations } from "./routes/configuration";
import { ErrorHandler } from "./middlewares/error-handler";
import { dbPool } from './shared/database';
import { ConnectionPool } from 'mssql';
import { logger } from "./lib/logger";
import cluster from "cluster";
import * as OS from 'os'
dotenv.config(); 

const PORT = process.env.PORT
const totalCPUs = OS.cpus().length;
if(false){
	console.log(`Number of CPUs is ${totalCPUs}`);
	console.log(`Master ${process.pid} is running`);
	
	// Fork workers.
	for (let i = 0; i < totalCPUs; i++) {
		cluster.fork();
	}
	
	cluster.on("exit", (worker, code, signal) => {
		console.log(`worker ${worker.process.pid} died`);
		console.log("Let's fork another worker!");
		cluster.fork();
	});
}else{
	const app = express();
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(bodyParser.json());
	app.use(cookieParser());
	app.use('/css', express.static(path.join(process.cwd(), '/public/css')))
	app.use('/js', express.static(path.join(process.cwd(), '/public/js')))
	app.use('/img', express.static(path.join(process.cwd(), '/public/img')))
	app.engine('html', ejs.renderFile);
	app.set('view engine', 'html');
	app.set('views', path.join(process.cwd(), '/src/views'));
	sp.setup({
		sp: {
			fetchClientFactory: () => {
				setProxyUrl(process.env.GLOBAL_AGENT_HTTP_PROXY as string)
				return new NodeFetchClient(); 
			},
		},
	}); 
	// if(cron.validate('* * * * * *')){
	// 	cron.schedule('* * * * * *',() => {
			
	// 	})
	// }

	app.use(DocumentPush)
	app.use(DocumentPull)
	app.use(Transactions)
	app.use(Configurations)

	app.get('/', (req, res) => {
		console.log(`Worker ${process.pid} started`);
		res.send("Hello to Aconex !");
	})
	app.use(ErrorHandler)

	https.createServer({
		key: fs.readFileSync(path.join(process.cwd(), './cert/key.pem')),
		cert: fs.readFileSync(path.join(process.cwd(), './cert/cert.pem'))
	}, app).
	listen(PORT, async () => {
		
		logger.info("Server Started on Port number : " + PORT);
		
		try{
			const mssql: ConnectionPool | null = await dbPool.connect()
		}catch(e){
			logger.info("Database Error:  Connection Failed");
			process.exit()
		}
	});
}


const line = function(message: any) 
{
    const e: any = new Error();
    let regex = /([^\(\s]*):(\d+):(\d+)/
    const match: any = regex.exec(e.stack.split("\n")[2]);
    const filepath = match[1];
    const fileName = path.basename(filepath);
    const line = match[2];
    // const column = match[3];
    // : [Line Number ~ ${line}:${column}]
    return `${message} at [${fileName}:${line}]`;
}

export {line as line}