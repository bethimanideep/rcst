const crypto = require('crypto')
var encryptedMessage = process.argv[2]
var secret_key = "e67c8ce7-973d-4fe2-9ec9-f471f1d7adcc"; 
var secret_iv = "07eda105-30c8-488b-87d4-bd59dfd2ba0a"; 
var encryptionMethod = 'AES-256-CBC';
var key = crypto.createHash('sha512').update(secret_key,'utf-8').digest('hex').substr(0,32);
var iv = crypto.createHash('sha512').update(secret_iv,'utf-8').digest('hex').substr(0,16);
const buff = Buffer.from(encryptedMessage, 'base64');
encryptedMessage = buff.toString('utf-8');
var decyptor = crypto.createDecipheriv(encryptionMethod, key, iv);
var decPassword = decyptor.update(encryptedMessage, 'base64', 'utf-8') + decyptor.final('utf-8');
console.log(decPassword)