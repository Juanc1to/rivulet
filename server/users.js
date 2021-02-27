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

function update(db, details) {
  /*if (details.id === undefined) {
    throw Error('Update requires a user id.');
  }
  if (details.name === undefined) {
    details.name = null;
  }
  if (details.email === undefined) {
    details.email = null;
  }*/
  const update_query = db.prepare(`
    update users set name = $name, email = $email,
      updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      where id = $id`);
  const info = update_query.run(details);
  return info.lastInsertRowid;
}

function from_anonymous_token(db, anonymous_token) {
  // TODO: Need an index on the anonymous_token in the users table...
  const select_query = db.prepare(`
    select * from users where anonymous_token = $anonymous_token`);
  const rows = select_query.all({ anonymous_token });
  if (rows.length > 1) {
    throw Error('Somehow the same token is assigned to several user ids');
  }
  if (rows.length === 0) {
    return undefined;
  }
  return rows[0];
}

module.exports = Object.freeze({ anonymous, from_anonymous_token, update });
