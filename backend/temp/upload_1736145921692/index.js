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
exports.line = void 0;
const global_agent_1 = require("global-agent");
(0, global_agent_1.bootstrap)();
const nodejs_commonjs_1 = require("@pnp/nodejs-commonjs");
const sp_commonjs_1 = require("@pnp/sp-commonjs");
const fs_1 = __importDefault(require("fs"));
const https_1 = __importDefault(require("https"));
const express_1 = __importDefault(require("express"));
require("express-async-errors");
const path_1 = __importDefault(require("path"));
const body_parser_1 = __importDefault(require("body-parser"));
const ejs = __importStar(require("ejs"));
const dotenv = __importStar(require("dotenv"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const push_1 = require("./routes/push");
const pull_1 = require("./routes/pull");
const transactions_1 = require("./routes/transactions");
const configuration_1 = require("./routes/configuration");
const error_handler_1 = require("./middlewares/error-handler");
const database_1 = require("./shared/database");
const logger_1 = require("./lib/logger");
const cluster_1 = __importDefault(require("cluster"));
const OS = __importStar(require("os"));
dotenv.config();
const PORT = process.env.PORT;
const totalCPUs = OS.cpus().length;
if (false) {
    console.log(`Number of CPUs is ${totalCPUs}`);
    console.log(`Master ${process.pid} is running`);
    // Fork workers.
    for (let i = 0; i < totalCPUs; i++) {
        cluster_1.default.fork();
    }
    cluster_1.default.on("exit", (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
        console.log("Let's fork another worker!");
        cluster_1.default.fork();
    });
}
else {
    const app = (0, express_1.default)();
    app.use(body_parser_1.default.urlencoded({ extended: false }));
    app.use(body_parser_1.default.json());
    app.use((0, cookie_parser_1.default)());
    app.use('/css', express_1.default.static(path_1.default.join(process.cwd(), '/public/css')));
    app.use('/js', express_1.default.static(path_1.default.join(process.cwd(), '/public/js')));
    app.use('/img', express_1.default.static(path_1.default.join(process.cwd(), '/public/img')));
    app.engine('html', ejs.renderFile);
    app.set('view engine', 'html');
    app.set('views', path_1.default.join(process.cwd(), '/src/views'));
    sp_commonjs_1.sp.setup({
        sp: {
            fetchClientFactory: () => {
                (0, nodejs_commonjs_1.setProxyUrl)(process.env.GLOBAL_AGENT_HTTP_PROXY);
                return new nodejs_commonjs_1.NodeFetchClient();
            },
        },
    });
    // if(cron.validate('* * * * * *')){
    // 	cron.schedule('* * * * * *',() => {
    // 	})
    // }
    app.use(push_1.DocumentPush);
    app.use(pull_1.DocumentPull);
    app.use(transactions_1.Transactions);
    app.use(configuration_1.Configurations);
    app.get('/', (req, res) => {
        console.log(`Worker ${process.pid} started`);
        res.send("Hello to Aconex !");
    });
    app.use(error_handler_1.ErrorHandler);
    https_1.default.createServer({
        key: fs_1.default.readFileSync(path_1.default.join(process.cwd(), './cert/key.pem')),
        cert: fs_1.default.readFileSync(path_1.default.join(process.cwd(), './cert/cert.pem'))
    }, app).
        listen(PORT, async () => {
        logger_1.logger.info("Server Started on Port number : " + PORT);
        try {
            const mssql = await database_1.dbPool.connect();
        }
        catch (e) {
            logger_1.logger.info("Database Error:  Connection Failed");
            process.exit();
        }
    });
}
const line = function (message) {
    const e = new Error();
    let regex = /([^\(\s]*):(\d+):(\d+)/;
    const match = regex.exec(e.stack.split("\n")[2]);
    const filepath = match[1];
    const fileName = path_1.default.basename(filepath);
    const line = match[2];
    // const column = match[3];
    // : [Line Number ~ ${line}:${column}]
    return `${message} at [${fileName}:${line}]`;
};
exports.line = line;
