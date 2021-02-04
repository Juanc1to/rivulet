// external utilities
const { Repeat } = require('immutable');

// model modules
const app = require('../app');
const users = require('../users');
const watersheds = require('../watersheds');
const branches = require('../branches');

// local utilities
const { drop_all_tables_factory } = require('./db/util');

const db = app.get('db');

//afterAll(drop_all_tables_factory(db));

it('Can create new watersheds', function () {
  const id = watersheds.watershed(db);

  const rows = db.prepare(
    'select * from watersheds where id = $id').all({ id });
  expect(rows.length).toBe(1);
});

describe('A user', function () {
  it('can create an anonymous account', function () {
    const id = users.anonymous(db);

    const rows = db.prepare(
      'select * from users where id = $id').all({ id });
    expect(rows.length).toBe(1);
  });

  it('can join a watershed (ending up in a branch)', function () {
    const user_id = users.anonymous(db);
    const user2_id = users.anonymous(db);
    const watershed_id = watersheds.watershed(db);
    const branch_id = branches.join(db, user_id, watershed_id);
    const branch2_id = branches.join(db, user2_id, watershed_id);

    expect(branch_id).toBe(branch2_id);
    const rows = db.prepare(
      `select * from participation
         where user_id = $user_id
         and branch_id = $branch_id`).all({ user_id, branch_id });
    expect(rows.length).toBe(1);
  });

  /*it('can get a summary of their current branch', function () {
  });*/

  it('will be assigned a new branch when existing branches are full',
      function () {
    const branch_size = 3;
    const watershed_id = watersheds.watershed(db, branch_size);
    const user_spots = Repeat(undefined, branch_size + 1);
    const assigned = user_spots.map(function userjoin() {
      const user_id = users.anonymous(db);
      const branch_id = branches.join(db, user_id, watershed_id);
      return branch_id;
    }).toList();
    expect(assigned.first()).not.toBe(assigned.last());
  });
});
