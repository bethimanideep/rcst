export abstract class UICustomError extends Error{
    abstract statusCode: number
    constructor(){
        super()
        Object.setPrototypeOf(this,UICustomError.prototype)
    }
    abstract serializeError() : {title: string, message: string} 
}