"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkControllerUser = void 0;
const unauthorized_user_1 = require("../errors/unauthorized-user");
const checkControllerUser = async (req, res, next) => {
    try {
        const userSP = req.userSP;
        let groups = await userSP.web.currentUser.groups();
        let exists = false;
        for (let g of groups) {
            if (g.Title === process.env.SPSITE_CONFIG_GROUP) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            throw new unauthorized_user_1.UnAuthorizedError();
        }
    }
    catch (e) {
        throw new unauthorized_user_1.UnAuthorizedError();
    }
    next();
};
exports.checkControllerUser = checkControllerUser;
