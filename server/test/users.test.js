// external utilities
const { Repeat, Map } = require('immutable');

// model modules
const app = require('../app');
const users = require('../users');
const watersheds = require('../watersheds');

// local utilities
const { drop_all_tables_factory } = require('./db/util');

const db = app.get('db');

afterAll(drop_all_tables_factory(db));

/* Several tests function by adding enough users to "overflow" a new branch
 * in a new watershed, in order to check behavior "inside" and "outside"
 * that branch.
 */
function overflowList(branch_size = 3) {
  const watershed_id = watersheds.watershed(db, branch_size);
  const user_spots = Repeat(undefined, branch_size + 1);
  return user_spots.map(function userjoin() {
    const user_id = users.anonymous(db);
    const branch_id = watersheds.join(db, user_id, watershed_id);
    return branch_id;
  }).toList();
}

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

  it('can join a watershed (ending up in a branch)', db.transaction(
  function () {
    const user_id = users.anonymous(db);
    const user2_id = users.anonymous(db);
    const watershed_id = watersheds.watershed(db);
    const branch_id = watersheds.join(db, user_id, watershed_id);
    const branch2_id = watersheds.join(db, user2_id, watershed_id);

    expect(branch_id).toBe(branch2_id);
    const rows = db.prepare(
      `select * from participation
         where user_id = $user_id
         and branch_id = $branch_id`).all({ user_id, branch_id });
    expect(rows.length).toBe(1);
  }));

  it('can get a summary of their current branch', db.transaction(function () {
    const user_id = users.anonymous(db);
    const user2_id = users.anonymous(db);
    const watershed_id = watersheds.watershed(db);
    const branch_id = watersheds.join(db, user_id, watershed_id);
    const branch2_id = watersheds.join(db, user2_id, watershed_id);
    const summary = watersheds.summary(db, user_id, watershed_id);

    expect(summary.get('branch_members').size).toBe(2);
    expect(summary.get('watershed_participants_nr')).toBeGreaterThanOrEqual(2);
    expect(summary.get('message_nr')).toBe(0);
    expect(summary.get('messages_page').size).toBe(0);
    expect(summary.get('progression')).toBe(0);
  }));

  it('will be assigned a new branch when existing branches are full',
      db.transaction(function () {
    const branch_size = 3;
    const watershed_id = watersheds.watershed(db, branch_size);
    const user_spots = Repeat(undefined, branch_size + 1);
    const assigned = user_spots.map(function userjoin() {
      const user_id = users.anonymous(db);
      const branch_id = watersheds.join(db, user_id, watershed_id);
      return branch_id;
    }).toList();
    expect(assigned.first()).not.toBe(assigned.last());
  }));

  it('can send a message with scope restricted to their branch',
      db.transaction(function () {
    const branch_size = 3;
    const watershed_id = watersheds.watershed(db, branch_size);
    const user_spots = Repeat(undefined, branch_size + 1);
    const new_users = user_spots.map(function userjoin() {
      const user_id = users.anonymous(db);
      const branch_id = watersheds.join(db, user_id, watershed_id);
      return user_id;
    }).toList();

    const msg_from_first = watersheds.message(db, Map({
      author_id: new_users.first(),
      content: "from first",
      watershed_id,
    }));
    const msg_from_last = watersheds.message(db, Map({
      author_id: new_users.last(),
      content: "from last",
      watershed_id,
    }));
    const first_summary = watersheds.summary(db, new_users.first(),
                                             watershed_id);
    const last_summary = watersheds.summary(db, new_users.last(),
                                            watershed_id);
    expect(first_summary.get('message_nr')).toBe(1);
    expect(last_summary.get('message_nr')).toBe(1);
    function peek_content(details) {
      return details.get('content');
    }
    expect(first_summary.get('messages_page').map(peek_content).toArray())
      .toContain('from first');
    expect(last_summary.get('messages_page').map(peek_content).toArray())
      .toContain('from last');
  }));
});
