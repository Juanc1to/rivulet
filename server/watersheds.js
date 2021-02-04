const config = require('config');

function watershed(db, branch_size) {
  if (branch_size === undefined) {
    if (config.has('branch_size')) {
      branch_size = config.get('branch_size');
    } else {
      branch_size = 5;
    }
  }

  const insert_query = db.prepare(
    `insert into watersheds (branch_size, updated) values (
       $branch_size,
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     )`);
  const info = insert_query.run({ branch_size });
  return info.lastInsertRowid;
}

module.exports = Object.freeze({ watershed });


