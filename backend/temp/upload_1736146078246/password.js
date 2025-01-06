"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptedPassword = exports.encryptedPassword = void 0;
const crypto_1 = __importDefault(require("crypto"));
const encryptedPassword = (acxpassword) => {
    var secret_key = process.env.SECRET_KEY;
    var secret_iv = process.env.SECRET_IV;
    var encryptionMethod = 'AES-256-CBC';
    var key = crypto_1.default.createHash('sha512').update(secret_key, 'utf-8').digest('hex').substr(0, 32);
    var iv = crypto_1.default.createHash('sha512').update(secret_iv, 'utf-8').digest('hex').substr(0, 16);
    var encryptor = crypto_1.default.createCipheriv(encryptionMethod, key, iv);
    var aes_encrypted = encryptor.update(acxpassword, 'utf8', 'base64') + encryptor.final('base64');
    return Buffer.from(aes_encrypted).toString('base64');
};
exports.encryptedPassword = encryptedPassword;
const decryptedPassword = (encryptedMessage) => {
    var secret_key = process.env.SECRET_KEY;
    var secret_iv = process.env.SECRET_IV;
    var encryptionMethod = 'AES-256-CBC';
    var key = crypto_1.default.createHash('sha512').update(secret_key, 'utf-8').digest('hex').substr(0, 32);
    var iv = crypto_1.default.createHash('sha512').update(secret_iv, 'utf-8').digest('hex').substr(0, 16);
    const buff = Buffer.from(encryptedMessage, 'base64');
    encryptedMessage = buff.toString('utf-8');
    var decyptor = crypto_1.default.createDecipheriv(encryptionMethod, key, iv);
    return decyptor.update(encryptedMessage, 'base64', 'utf-8') + decyptor.final('utf-8');
};
exports.decryptedPassword = decryptedPassword;
