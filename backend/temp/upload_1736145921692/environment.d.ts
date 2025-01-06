export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SP_CLIENTID: string;
      SP_CLIENTSECRET: string,
      DB_USER: string,
      DB_PASSWORD: string,
      DB_HOST: string,
      DB_NAME: string,
      PORT: number,
      SPSITE_ACCESS_GROUP: string,
      SPSITE_ADMIN_GROUP: string,
      SPSITE_CONFIG_GROUP: string
    }
  }
}