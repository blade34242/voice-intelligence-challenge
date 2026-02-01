declare module "sql.js" {
  export type SqlJsConfig = {
    wasmBinary?: Uint8Array;
    locateFile?: (file: string) => string;
  };

  export type SqlValue = string | number | null | Uint8Array;

  export type Statement = {
    bind: (params?: SqlValue[] | Record<string, SqlValue>) => void;
    step: () => boolean;
    getAsObject: () => Record<string, SqlValue>;
    free: () => void;
    run: (params?: SqlValue[] | Record<string, SqlValue>) => void;
  };

  export type Database = {
    exec: (sql: string, params?: SqlValue[] | Record<string, SqlValue>) => Array<{
      columns: string[];
      values: SqlValue[][];
    }>;
    prepare: (sql: string) => Statement;
    export: () => Uint8Array;
    getRowsModified: () => number;
  };

  export type SqlJsStatic = {
    Database: new (data?: Uint8Array) => Database;
  };

  const initSqlJs: (config?: SqlJsConfig) => Promise<SqlJsStatic>;
  export default initSqlJs;
}
