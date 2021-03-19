// external utilities
const { Repeat, Map } = require('immutable');

// model modules
const { app } = require('../app');
const users = require('../users');
const watersheds = require('../watersheds');

// local utilities
const util = require('./db/util');

const db = app.get('db');

// afterAll(util.drop_all_tables_factory(db));

afterEach(util.delete_from_each_table_factory(db));

/* Several tests function by adding enough users to "overflow" a new branch
 * in a new watershed, in order to check behavior "inside" and "outside"
 * that branch.
 *
 * That said, we're not actually using this function at the moment...
 */
function overflowList(branch_size = 3) {
  const watershed_id = watersheds.watershed(db, { branch_size });
  const user_spots = Repeat(undefined, branch_size + 1);
  return user_spots.map(function userjoin() {
    const { user_id } = users.anonymous(db);
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
    const id = users.anonymous(db).user_id;

    const rows = db.prepare(
      'select * from users where id = $id').all({ id });
    expect(rows.length).toBe(1);
  });

  it('can update the personal details of their account', function () {
    const id = users.anonymous(db).user_id;

    const details = { id, name: 'test name', email: 'test@email.ext' };
    users.update(db, details);
    const rows = db.prepare(
      'select * from users where name = $name and email = $email')
      .all(details);
    expect(rows[0].id).toBe(id);
  });

  it('can join a watershed (ending up in a branch)',
     db.transaction(function () {
    const user_id = users.anonymous(db).user_id;
    const user2_id = users.anonymous(db).user_id;
    const watershed_id = watersheds.watershed(db);
    const branch_id = watersheds.join(db, user_id, watershed_id);
    const branch2_id = watersheds.join(db, user2_id, watershed_id);

    expect(branch_id).toBe(branch2_id);
    const rows = db.prepare(
      `select * from participation
         where user_id = $user_id
         and branch_id = $branch_id`).all({ user_id, branch_id });
    expect(rows.length).toBe(1);

    const watershed2_id = watersheds.watershed(db);
    const branch3_id = watersheds.join(db, user_id, watershed2_id);
    const rows2 = db.prepare(
      `select * from participation
         where user_id = $user_id
         and branch_id = $branch3_id`).all({ user_id, branch3_id });
    expect(rows2.length).toBe(1);
  }));

  it('can browse the details of a single watershed',
     db.transaction(function () {
    const watershed_options = { branch_size: 3, name: 'n', description: 'd' };
    const watershed_id = watersheds.watershed(db, watershed_options);

    const details = watersheds.browse(db, { id: watershed_id });
    expect(details.get(0).toJS()).toEqual({
      ...watershed_options,
      id: expect.anything(),
      updated: expect.anything(),
      nr_participants: 0,
    });
  }));

  it('can get a summary of their current branch', db.transaction(function () {
    const user_id = users.anonymous(db).user_id;
    const user2_id = users.anonymous(db).user_id;
    const watershed_id = watersheds.watershed(db);
    const branch_id = watersheds.join(db, user_id, watershed_id);
    const branch2_id = watersheds.join(db, user2_id, watershed_id);
    const summary = watersheds.summary(db, user_id, watershed_id);

    expect(summary.get('branch_members').size).toBe(2);
    expect(summary.get('nr_watershed_participants')).toBe(2);
    expect(summary.get('nr_messages')).toBe(0);
    expect(summary.get('messages_page').size).toBe(0);
    expect(summary.get('progression')).toBe(0);
  }));

  it('can get a list of all watersheds', db.transaction(function () {
    const watershed_details = {
      branch_size: 7,
      name: 'test watershed',
      description: 'a sample watershed',
    }
    const watershed_id = watersheds.watershed(db, watershed_details);
    const user_id = users.anonymous(db).user_id;
    const before_join_list = watersheds.browse(db);

    expect(before_join_list.size).toBe(1);
    expect(before_join_list.get(0).toObject()).toEqual({
      id: expect.anything(),
      updated: expect.anything(),
      nr_participants: 0,
      ...watershed_details
    });

    const branch_id = watersheds.join(db, user_id, watershed_id);
    const watersheds_list = watersheds.browse(db);

    expect(watersheds_list.size).toBe(1);
    expect(watersheds_list.get(0).toObject()).toEqual({
      id: expect.anything(),
      updated: expect.anything(),
      nr_participants: 1,
      ...watershed_details
    });
  }));

  it('will be assigned a new branch when existing branches are full',
     db.transaction(function () {
    const branch_size = 3;
    const watershed_id = watersheds.watershed(db, { branch_size });
    const user_spots = Repeat(undefined, branch_size + 1);
    const assigned = user_spots.map(function userjoin() {
      const user_id = users.anonymous(db).user_id;
      const branch_id = watersheds.join(db, user_id, watershed_id);
      return branch_id;
    }).toList();
    expect(assigned.first()).not.toBe(assigned.last());
  }));

  it('will be assigned a new branch when they leave their current branch',
     db.transaction(function () {
    const watershed_options = { branch_size: 3, name: 'n', description: 'd' };
    const watershed_id = watersheds.watershed(db, watershed_options);
    const user_id = users.anonymous(db).user_id;
    const user2_id = users.anonymous(db).user_id;
    const branch_id = watersheds.join(db, user_id, watershed_id);
    watersheds.join(db, user2_id, watershed_id);
    const nr_changes = watersheds.leave(db, user_id, watershed_id);
    expect(nr_changes).toBe(1);

    const details = watersheds.browse(db, { id: watershed_id });
    expect(details.get(0).toJS()).toEqual({
      ...watershed_options,
      id: expect.anything(),
      updated: expect.anything(),
      nr_participants: 1,
    });

    const branch2_id = watersheds.join(db, user_id, watershed_id);
    expect(branch_id).not.toBe(branch2_id);
  }));

  it('can send a message with scope restricted to their branch',
     db.transaction(function () {
    const branch_size = 3;
    const watershed_id = watersheds.watershed(db, { branch_size });
    const user_spots = Repeat(undefined, branch_size + 1);
    const new_users = user_spots.map(function userjoin() {
      const user_id = users.anonymous(db).user_id;
      const branch_id = watersheds.join(db, user_id, watershed_id);
      return user_id;
    }).toList();

    const msg_from_first = watersheds.message(db, {
      author_id: new_users.first(),
      content: "from first",
      watershed_id,
    });
    const msg_from_last = watersheds.message(db, {
      author_id: new_users.last(),
      content: "from last",
      watershed_id,
    });
    const first_summary = watersheds.summary(db, new_users.first(),
                                             watershed_id);
    const last_summary = watersheds.summary(db, new_users.last(),
                                            watershed_id);
    expect(first_summary.get('nr_messages')).toBe(1);
    expect(last_summary.get('nr_messages')).toBe(1);
    function peek_content(details) {
      return details.get('content');
    }
    expect(first_summary.get('messages_page').map(peek_content).toArray())
      .toContain('from first');
    expect(last_summary.get('messages_page').map(peek_content).toArray())
      .toContain('from last');
  }));

  it('can add and delete reactions to a message', db.transaction(function () {
    const watershed_id = watersheds.watershed(db);
    const user_id = users.anonymous(db).user_id;
    const branch_id = watersheds.join(db, user_id, watershed_id);
    const message_id = watersheds.message(db, {
      author_id: user_id, content: 'test message', watershed_id });
    const reaction_id = watersheds.reaction(db, {
      user_id, intent: "+1", message_id });
    let reactions = watersheds.reactions(db, message_id);
    expect(reactions.size).toBe(1);
    expect(reactions.get(0).get('intent')).toBe('+1');
    const result = watersheds.delete_reaction(db, {
      user_id, intent: "+1", message_id });
    reactions = watersheds.reactions(db, message_id);
    expect(reactions.size).toBe(0);
  }));

  it('cannot add a reaction to a message outside of their branch',
     db.transaction(function () {
    const branch_size = 3;
    const watershed_id = watersheds.watershed(db, { branch_size });
    const user_spots = Repeat(undefined, branch_size + 1);
    const new_users = user_spots.map(function userjoin() {
      const user_id = users.anonymous(db).user_id;
      const branch_id = watersheds.join(db, user_id, watershed_id);
      return user_id;
    }).toList();

    const message_id = watersheds.message(db, {
      author_id: new_users.first(),
      content: "from first",
      watershed_id,
    });
    expect(function () {
      watersheds.reaction(db,
        { user_id: new_users.last(), intent: "+1", message_id })
    }).toThrow('different branch')
  }));
});
