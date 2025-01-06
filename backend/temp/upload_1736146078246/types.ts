export interface SiteProfileSetting{
    SiteProfileName: string,
    SharepointSite: string,
    AconexInstanceURL: string,
    AconexProjectID: number,
    MetadataMapping: string,
    AconexInstanceName: string,
    SharepointSiteLibrary: string,
}

export interface MetadataMapping{
    [key: string]: string;
}

export interface AconexInstanceCredentials{
    AconexURL: string,
    ServiceAccountName: string,
    Password:string,
    InstanceName: string,
    Status: number
}

export interface AttributesMapping{
    ProjectID: string,
    StringValue: string,
    IntegerValue: number
}

export interface AconexProject{
    AconexURL: string,
    ProjectID: string,
    ProjectName: string,
    InstanceName: string
}

export interface AconexAttributes{
    DisplayLabel: string,
    CreateIdentifier: string,
    MetadataIdentifier: string,
    SearchIdentifier: string
}

export interface OperationResponse{
    sync: boolean,
    error?: string,
    item?:number
}

export enum OperationActions{
    PUSH = 'PUSH',
    PULL = 'PULL'
}

export enum OperationStatus{
    FAILED = 'FAILED',
    SUCCESSFULL = 'SUCCESSFULL',
    PENDING = 'PENDING'
}

export enum DocumentPullActions{
    EXISTS = 'exists',
    NOTEXISTS = 'notexists',
    UPDATED = 'uptodate'
}

export interface DocumentPullRequest{
    item: number,
    action: DocumentPullActions,
    docNo: string
}

export interface DocumentPullDetails{
    documentNo: string,
    revision: string,
    spVersion: number,
    ackVersion:number,
    documentName: string,
    action: DocumentPullActions,
    instance: string,
    project: number,
    projectName: string
    site: string,
    itemId: number,
    operation:OperationActions,
    user: string,
    message: string
}

export enum DocumentPushActions{
    VERSION = 'version',
    CREATE = 'create',
    UPDATED = 'uptodate',
    DOCNOREQUIRED = 'docno'
}

export interface DocumentPushRequest{
    item: number,
    action: DocumentPushActions,
}

export interface DocumentPushDetails{
    documentNo: string,
    revision: string,
    spVersion: number,
    ackVersion:number,
    documentName: string,
    action: DocumentPushActions,
    instance: string,
    project: number,
    projectName: string
    site: string,
    itemId: number,
    operation:OperationActions,
    user: string,
    message: string
}

export interface Transaction{
    TransactionNumber: string,
    DocumentName: string,
    DocumentNumber: string,
    SPDocumentID: string,
    Operation: OperationActions,
    AconexDocVersionNo: number,
    RevisionNo: string,
    SharepointDocVersionNo: number,
    AconexProjectID: number,
    AconexProjectName: string,
    AconexInstance: string,
    SharepointSiteName: string,
    SharepointSiteID: string,
    TransactionDate: string,
    TransactionUser: string,
    Status: OperationStatus,
    Error: string,
    SPSiteLibrary: string
}

export enum Messages{
    DOCNOREQUIRED = 'Document No. not available',
    NOTAVAILABLE = 'Not available',
    UPDATED = 'Already upto date',
    VERSION = 'Create New Version',
    PULL = 'Ready to pull',
    CREATE = 'Create Document',
    CONFIG_NOT_FOUND = "Sharepoint Site profile configuration is not available. Please add the configuration and then retry.",
    CONFIG_DISABLED = "Sharepoint Site profile configuration is not enabled. Please enable the configuration and then retry.",
    INSTANCE_NOT_FOUND = "Aconex instance is not available. Please add the instance and then retry.",
    INSTANCE_DISABLED = "Aconex instance is not enabled. Please enable the instance and then retry.",
    PROJECT_NOT_FOUND = "Aconex project details are not available for this site.Please add the project and retry.",
    COMMON = "Server failed to respond. Please contact administrator.",
    ERRORDOCFETCH="Server failed to get the document. Please retry again or contact to administrator"
}


