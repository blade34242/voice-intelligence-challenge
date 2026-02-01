declare module "better-sqlite3" {
  class Database {
    constructor(path: string);
    prepare: (...args: any[]) => any;
    exec: (...args: any[]) => any;
    pragma: (...args: any[]) => any;
  }

  export default Database;
}
