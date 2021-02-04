const { v4: uuid } = require('uuid');

function anonymous(db) {
  const insert_query = db.prepare(
    `insert into users (anonymous_token, updated) values (
       $token,
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     )`);
  const info = insert_query.run({ token: uuid() });
  return info.lastInsertRowid;
}

function join(db, user_id, watershed_id) {
}

function represent(db, user_id, branch_id) {
}

module.exports = Object.freeze({ anonymous, join, represent });
