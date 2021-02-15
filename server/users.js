const { v4: uuid } = require('uuid');

function anonymous(db) {
  const insert_query = db.prepare(`
    insert into users (anonymous_token, updated) values (
      $anonymous_token,
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    )`);
  const anonymous_token = uuid();
  const info = insert_query.run({ anonymous_token });
  return { user_id: info.lastInsertRowid, anonymous_token };
}

function from_anonymous_token(db, anonymous_token) {
  // TODO: Need an index on the anonymous_token in the users table...
  const select_query = db.prepare(`
    select id from users where anonymous_token = $anonymous_token`);
  const rows = select_query.pluck().all({ anonymous_token });
  if (rows.length > 1) {
    throw Error('Somehow the same token is assigned to several user ids');
  }
  if (rows.length === 0) {
    return undefined;
  }
  return rows[0];
}

function represent(db, user_id, branch_id) {
}

module.exports = Object.freeze({ anonymous, from_anonymous_token, represent });
