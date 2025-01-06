const crypto = require('crypto')
var acxpassword = process.argv[2]
var secret_key = "e67c8ce7-973d-4fe2-9ec9-f471f1d7adcc"; 
var secret_iv = "07eda105-30c8-488b-87d4-bd59dfd2ba0a"; 
var encryptionMethod = 'AES-256-CBC';
var key = crypto.createHash('sha512').update(secret_key,'utf-8').digest('hex').substr(0,32);
var iv = crypto.createHash('sha512').update(secret_iv,'utf-8').digest('hex').substr(0,16);
var encryptor = crypto.createCipheriv(encryptionMethod,key,iv);
var aes_encrypted = encryptor.update(acxpassword, 'utf8', 'base64') + encryptor.final('base64');
var encPassword = Buffer.from(aes_encrypted).toString('base64');
console.log(encPassword)