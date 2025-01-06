import crypto from 'crypto'
export const encryptedPassword = (acxpassword: string) => 
{
    var secret_key: any = process.env.SECRET_KEY; 
    var secret_iv: any = process.env.SECRET_IV; 
    var encryptionMethod = 'AES-256-CBC';
    var key = crypto.createHash('sha512').update(secret_key,'utf-8').digest('hex').substr(0,32);
    var iv = crypto.createHash('sha512').update(secret_iv,'utf-8').digest('hex').substr(0,16);
    var encryptor = crypto.createCipheriv(encryptionMethod,key,iv);
    var aes_encrypted = encryptor.update(acxpassword, 'utf8', 'base64') + encryptor.final('base64');
    return Buffer.from(aes_encrypted).toString('base64');
}

export const decryptedPassword = (encryptedMessage: any) => 
{
    var secret_key: any = process.env.SECRET_KEY; 
    var secret_iv: any = process.env.SECRET_IV; 
    var encryptionMethod = 'AES-256-CBC';
    var key = crypto.createHash('sha512').update(secret_key,'utf-8').digest('hex').substr(0,32);
    var iv = crypto.createHash('sha512').update(secret_iv,'utf-8').digest('hex').substr(0,16);
    const buff = Buffer.from(encryptedMessage, 'base64');
    encryptedMessage = buff.toString('utf-8');
    var decyptor = crypto.createDecipheriv(encryptionMethod, key, iv);
    return decyptor.update(encryptedMessage, 'base64', 'utf-8') + decyptor.final('utf-8');
}
