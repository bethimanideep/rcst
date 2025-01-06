import { IFileInfo, IListInfo, SPRest } from '@pnp/sp-commonjs';
import express, { Request, Response } from 'express'
import { ConnectionPool, IRecordSet, IResult } from 'mssql';
import { InternalServerError } from '../errors/internal-server-error';
import { logger } from '../lib/logger';
import { checkAccessUser } from '../middlewares/check-access-user';
import { checkAuth, checkAuthFromCookie } from '../middlewares/check-auth';
import DatabaseConnect from '../shared/database';
import { Transaction } from '../types/types';
import { line } from '../index';

const router = express.Router(); 

router.post('/aconex/transactions', checkAuth,checkAccessUser,async (req: Request, res: Response) => {
	logger.info("Transactions UI Single File :Connecting To Database")
	const mssql: ConnectionPool | null = await DatabaseConnect()
	logger.info("Transactions UI Single File :Connected To Database")
	if(mssql)
	{
		try
		{
			const userSP: SPRest  = req.userSP!
			const SiteList: string = req.query && req.query.sListId ?req.query.sListId.toString(): '';
			const library: IListInfo = await userSP.web.lists.getById(SiteList).select("Title")();
			logger.info("Transactions UI Single File : SP Library: "+ library.Title)
			const spItemId:string = req.query && req.query.sItemId ?req.query.sItemId.toString().split(',')[0]:'';
			logger.info("Transactions UI Single File : SP Item ID: "+ spItemId)
			const list = await userSP.web.lists.getByTitle(library.Title).items.getById(parseInt(spItemId)).select('File').expand("File").get();
			const spFileInfo: IFileInfo = list.File;
			logger.info("Transactions UI Single File : SP File: "+ JSON.stringify(spFileInfo))
			res.render("transactions",{uniqueId: spFileInfo.UniqueId});
		}
		catch(err: any)
		{
			logger.error("Transactions UI Single File: Failed to get the Document: "+ err.message);
            throw new InternalServerError("Failed to get the Documents")
		}
        
	}
})

router.post('/aconex/transactions/library', checkAuth,checkAccessUser,async (req: Request, res: Response) => 
{
	const mssql: ConnectionPool | null = await DatabaseConnect()
	if(mssql){
		res.render("transactions",{uniqueId: ''});
	}
})

router.post("/aconex/transactions/library/data",checkAuthFromCookie,checkAccessUser,async (req:Request,res: Response) => {
	logger.info("Transactions Data :Connecting To Database")
	const mssql: ConnectionPool | null = await DatabaseConnect()
	logger.info("Transactions Data :Connected To Database")
	if(mssql)
	{
		try{
			const userSP: SPRest  = req.userSP!
			const SPSite: string = req.cookies.SPSiteUrl
			const SiteList: string = req.cookies.SiteLibrary;
			const library: IListInfo = await userSP.web.lists.getById(SiteList).select("Title")();
			const columns = [
				"TransactionNumber",
				"TransactionNumber",
				"TransactionDate",
				"TransactionUser",
				"SharepointSiteName",
				"SPSiteLibrary",
				"AconexInstance",
				"AconexProjectID",
				"AconexProjectName",
				"DocumentName",
				"Operation",
				"DocumentNumber",
				"RevisionNo",
				"SharepointDocVersionNo",
				"AconexDocVersionNo",
				"Status",
				"Error"
			]
			let transactionQuery = `select * from Transactions where SharepointSiteName='${SPSite}' and SPSiteLibrary='${library.Title}'`;
			let transactionCountQuery = `select count(*) as count from Transactions where SharepointSiteName='${SPSite}' and SPSiteLibrary='${library.Title}'`;
			if(req.body.uniqueId && req.body.uniqueId.trim().length > 0){
				transactionQuery += ` AND SPDocumentID='${req.body.uniqueId}'`
				transactionCountQuery += ` AND SPDocumentID='${req.body.uniqueId}'`
			}
			if(req.body.trStatus && req.body.trStatus.trim().length > 0){
				transactionQuery += ` AND Status='${req.body.trStatus}'`
				transactionCountQuery += ` AND Status='${req.body.trStatus}'`
			}
			if(req.body.docNo && req.body.docNo.trim().length > 0){
				transactionQuery += ` AND DocumentNumber='${req.body.docNo}'`
				transactionCountQuery += ` AND DocumentNumber='${req.body.docNo}'`
			}
			if(req.body.startDate && req.body.startDate.trim().length > 0 && req.body.endDate && req.body.endDate.trim().length > 0){
				transactionQuery += ` AND (format(TransactionDate, 'yyyy-MM-dd') >= '${req.body.startDate}' AND format(TransactionDate, 'yyyy-MM-dd') <= '${req.body.endDate}')`
				transactionCountQuery += ` AND (format(TransactionDate, 'yyyy-MM-dd') >= '${req.body.startDate}' AND format(TransactionDate, 'yyyy-MM-dd') <= '${req.body.endDate}')`
			}
			logger.info("Transactions Data : Total Count query: "+ transactionCountQuery)
			let transactionCount:IResult<{count:number}> = await mssql.query(transactionCountQuery);
			let totalCount = 0;
			if(transactionCount.recordsets.length==1 && transactionCount.recordsets[0] && transactionCount.recordsets[0][0]){
				totalCount = transactionCount.recordsets[0][0].count
			}
			logger.info("Transactions Data : Total Count : "+ totalCount)
			if(req.body['search[value]'] && req.body['search[value]'].trim().length > 0){
				let search = req.body['search[value]']
				transactionCountQuery += ` AND ( TransactionNumber LIKE '%${search}%' `; 
				transactionCountQuery += ` OR  Status LIKE '%${search}%' `; 
				transactionCountQuery += ` OR  TransactionUser LIKE '%${search}%' `;
				transactionCountQuery += ` OR  SharepointSiteName LIKE '%${search}%' `;
				transactionCountQuery += ` OR  SPSiteLibrary LIKE '%${search}%' `;
				transactionCountQuery += ` OR  AconexInstance LIKE '%${search}%' `;
				transactionCountQuery += ` OR  AconexProjectID LIKE '%${search}%' `;
				transactionCountQuery += ` OR  AconexProjectName LIKE '%${search}%' `;
				transactionCountQuery += ` OR  DocumentName LIKE '%${search}%' `;
				transactionCountQuery += ` OR  Operation LIKE '%${search}%' `;
				transactionCountQuery += ` OR  DocumentNumber LIKE '%${search}%' `;
				transactionCountQuery += ` OR  RevisionNo LIKE '%${search}%' `;
				transactionCountQuery += ` OR  SharepointDocVersionNo LIKE '%${search}%' `;
				transactionCountQuery += ` OR  AconexDocVersionNo LIKE '%${search}%' `;
				transactionCountQuery += ` OR  Error LIKE '%${search}%' `;
				transactionCountQuery += ` OR  Status LIKE '%${search}%' )`; 
				
				transactionQuery += ` AND ( TransactionNumber LIKE '%${search}%' `; 
				transactionQuery += ` OR  Status LIKE '%${search}%' `; 
				transactionQuery += ` OR  TransactionUser LIKE '%${search}%' `;
				transactionQuery += ` OR  SharepointSiteName LIKE '%${search}%' `;
				transactionQuery += ` OR  SPSiteLibrary LIKE '%${search}%' `;
				transactionQuery += ` OR  AconexInstance LIKE '%${search}%' `;
				transactionQuery += ` OR  AconexProjectID LIKE '%${search}%' `;
				transactionQuery += ` OR  AconexProjectName LIKE '%${search}%' `;
				transactionQuery += ` OR  DocumentName LIKE '%${search}%' `;
				transactionQuery += ` OR  Operation LIKE '%${search}%' `;
				transactionQuery += ` OR  DocumentNumber LIKE '%${search}%' `;
				transactionQuery += ` OR  RevisionNo LIKE '%${search}%' `;
				transactionQuery += ` OR  SharepointDocVersionNo LIKE '%${search}%' `;
				transactionQuery += ` OR  AconexDocVersionNo LIKE '%${search}%' `;
				transactionQuery += ` OR  Error LIKE '%${search}%' `;
				transactionQuery += ` OR  Status LIKE '%${search}%' )`; 
			}
			logger.info("Transactions Data : Total Filtered query: "+ transactionCountQuery)
			transactionCount = await mssql.query(transactionCountQuery);
			let totalFiltered = 0;
			if(transactionCount.recordsets.length==1 && transactionCount.recordsets[0] && transactionCount.recordsets[0][0]){
				totalFiltered = transactionCount.recordsets[0][0].count
			}
			logger.info("Transactions Data : Total Filtered: "+ totalFiltered)
			if(req.body['order[0][column]'] && req.body['order[0][dir]']){
				transactionQuery += ` ORDER BY ${columns[req.body['order[0][column]']]} ${req.body['order[0][dir]']}`
			}
			if(req.body['start'] && req.body['length']){
				transactionQuery += ` OFFSET ${req.body['start']} ROWS FETCH NEXT ${req.body['length']} ROWS ONLY`
			}
			logger.info("Transactions Data : Transaction query: "+ transactionQuery)
			let transactionsRequest: IResult<Transaction> = await mssql.query(transactionQuery)
			let transactions: IRecordSet<Transaction> = transactionsRequest.recordset
			let cnt = 1;
			let transactionsData: any[] = []
			for(let t of transactions){
				let docTransaction: any[] = [];
				docTransaction.push(cnt)
				docTransaction.push(t.TransactionNumber)
				docTransaction.push(new Date(t.TransactionDate).toDateString()+' '+new Date(t.TransactionDate).toLocaleTimeString())
				docTransaction.push(t.TransactionUser)
				docTransaction.push(t.SharepointSiteName)
				docTransaction.push(t.SPSiteLibrary)
				docTransaction.push(t.AconexInstance)
				docTransaction.push(t.AconexProjectID)
				docTransaction.push(t.AconexProjectName)
				docTransaction.push(t.DocumentName)
				docTransaction.push(t.Operation)
				docTransaction.push(t.DocumentNumber)
				docTransaction.push(t.RevisionNo)
				docTransaction.push(t.SharepointDocVersionNo)
				docTransaction.push(t.AconexDocVersionNo)
				docTransaction.push(t.Status)
				docTransaction.push(t.Error)
				transactionsData.push(docTransaction)
				cnt++
			}
			logger.info("Transactions Data : Transaction Data: "+ JSON.stringify(transactionsData))
			res.status(200).send({
				"draw": req.body.draw,
				"recordsTotal": totalCount,
				"recordsFiltered": totalFiltered,
				"data": transactionsData
			})
		}catch(err:any){
			logger.error("Transactions Data : Error Occurred: "+ err.message)
			throw new InternalServerError("Failed to get the transactions")
		}
		
	}
})

export {router as Transactions}