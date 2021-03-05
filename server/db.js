// Eventually my plan is to parameterize this whole file to allow for runtime
// configuration between SQLite3 and PostgreSQL.  Until then...
const Database = require('better-sqlite3');
const store_F = require('connect-sqlite3');
const config = require('config');
const { initialize } = require('./schemas/sqlite3');

function configure(app) {
  const db = new Database(config.get('sqlite').connection.filename);
  return initialize(db);
}

function dbstore(session) {
  const Store = store_F(session);
  if (config.has('connect-sqlite3')) {
    return new Store(config.get('connect-sqlite3'));
  }
  return new session.MemoryStore;
}

module.exports = Object.freeze({ configure, dbstore });
