"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Messages = exports.DocumentPushActions = exports.DocumentPullActions = exports.OperationStatus = exports.OperationActions = void 0;
var OperationActions;
(function (OperationActions) {
    OperationActions["PUSH"] = "PUSH";
    OperationActions["PULL"] = "PULL";
})(OperationActions = exports.OperationActions || (exports.OperationActions = {}));
var OperationStatus;
(function (OperationStatus) {
    OperationStatus["FAILED"] = "FAILED";
    OperationStatus["SUCCESSFULL"] = "SUCCESSFULL";
    OperationStatus["PENDING"] = "PENDING";
})(OperationStatus = exports.OperationStatus || (exports.OperationStatus = {}));
var DocumentPullActions;
(function (DocumentPullActions) {
    DocumentPullActions["EXISTS"] = "exists";
    DocumentPullActions["NOTEXISTS"] = "notexists";
    DocumentPullActions["UPDATED"] = "uptodate";
})(DocumentPullActions = exports.DocumentPullActions || (exports.DocumentPullActions = {}));
var DocumentPushActions;
(function (DocumentPushActions) {
    DocumentPushActions["VERSION"] = "version";
    DocumentPushActions["CREATE"] = "create";
    DocumentPushActions["UPDATED"] = "uptodate";
    DocumentPushActions["DOCNOREQUIRED"] = "docno";
})(DocumentPushActions = exports.DocumentPushActions || (exports.DocumentPushActions = {}));
var Messages;
(function (Messages) {
    Messages["DOCNOREQUIRED"] = "Document No. not available";
    Messages["NOTAVAILABLE"] = "Not available";
    Messages["UPDATED"] = "Already upto date";
    Messages["VERSION"] = "Create New Version";
    Messages["PULL"] = "Ready to pull";
    Messages["CREATE"] = "Create Document";
    Messages["CONFIG_NOT_FOUND"] = "Sharepoint Site profile configuration is not available. Please add the configuration and then retry.";
    Messages["CONFIG_DISABLED"] = "Sharepoint Site profile configuration is not enabled. Please enable the configuration and then retry.";
    Messages["INSTANCE_NOT_FOUND"] = "Aconex instance is not available. Please add the instance and then retry.";
    Messages["INSTANCE_DISABLED"] = "Aconex instance is not enabled. Please enable the instance and then retry.";
    Messages["PROJECT_NOT_FOUND"] = "Aconex project details are not available for this site.Please add the project and retry.";
    Messages["COMMON"] = "Server failed to respond. Please contact administrator.";
    Messages["ERRORDOCFETCH"] = "Server failed to get the document. Please retry again or contact to administrator";
})(Messages = exports.Messages || (exports.Messages = {}));
