const config = require('config');
const { List, Map } = require('immutable');

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

function joinQueries(db, user_id, watershed_id) {
  const params = { user_id, watershed_id };
  const participation_rows = db.prepare(`
    select branch_id from participation
      inner join branches on participation.branch_id = branches.id
      where branch_id is not null
            and branches.active
            and branches.watershed_id = $watershed_id
            and user_id = $user_id`).all(params);

  if (participation_rows.length > 1) {
    throw new Error('Somehow, this user is participating multiple times.');
  }
  if (participation_rows.length === 1) {
    // This join is actually a re-join...
    return participation_rows[0].branch_id;
  }

  /* We proceed by getting the progression (heh) associated with every row of
   * the participation table with respect to a particular watershed.  We group
   * these results by the user, and use the aggregate function `max` to
   * select the "furthest" progression.
   *
   * How much benefit would we gain from using this query directly as a
   * subquery in the `open_branches_rows` query that follows below?
   */
  const progression = db.prepare(`
    select max(coalesce(target_branch.progression,
                        source_branch.progression + 1, 0)) as progression --,
        -- We might want information like the following.  It's currently
        -- commented out, but note that it uses the \`max\` aggregate
        -- function as logical AND (which may be an SQLite-specific trick).
        --max(coalesce(target_branch.active, source_branch.active)) as active
      from users left join participation
        on users.id = participation.user_id
      left join branches as source_branch
        on participation.branch_source_id = source_branch.id
      left join branches as target_branch
        on participation.branch_id = target_branch.id
      where coalesce(source_branch.watershed_id,
                     target_branch.watershed_id) = $watershed_id
            -- We want to allow the case where the participation join filled
            -- in empty values, as it means that the user has no recorded
            -- participation, yet.
            or participation.user_id is null
      group by users.id
      having users.id = $user_id`).pluck().get(params);
  // The `pluck` method above returns the value of the first column, rather
  // than the whole row.  (But, since as currently formulated, it only has one
  // column...)

  /* Now, given a progression level, we want to be able to find the id of an
   * active branch in that watershed and at that progression level that is not
   * full.
   */
  const open_branches_rows = db.prepare(`
    select branches.id from branches
      inner join watersheds on watershed_id = watersheds.id
      where watershed_id = $watershed_id and active
            and progression = $progression
            and (
              select count(user_id) from participation
              where branch_id = branches.id
            ) < watersheds.branch_size `).all({ watershed_id, progression });

  let target_branch_id;
  if (open_branches_rows.length === 0) {
    // Create a new branch with the appropriate progression.
    const new_branch_info = db.prepare(`
      insert into branches (watershed_id, active, progression, updated)
        values ($watershed_id, true, $progression,
                strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`).run(
      { watershed_id, progression });
    target_branch_id = new_branch_info.lastInsertRowid;
  } else {
    target_branch_id = open_branches_rows[0].id;
  }

  const new_participation_info = db.prepare(`
    insert into participation (user_id, branch_id, last_seen)
      values ($user_id, $target_branch_id,
              strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`).run(
    { user_id, target_branch_id });
  return target_branch_id;
}

function join(db, user_id, watershed_id) {
  return db.transaction(joinQueries)(db, user_id, watershed_id);
}

function watershed_count_Q(db, watershed_id) {
  return db.prepare(`
    select count(*) from participation inner join branches on branch_id = id
      where active and watershed_id = $watershed_id`)
    .pluck().get({ watershed_id });
}

function messages_page_Q(db, branch_id) {
  // I need to figure out how to coordinate paging between the controller and
  // the model, at some point...
  return List(db.prepare(`
    select * from messages where branch_id = $branch_id`)
    .all({ branch_id }).map(Map));
}

function summaryQueries(db, user_id, watershed_id) {
  const branch_id = join(db, user_id, watershed_id);
  const branch_members = List(db.prepare(`
    select user_id from participation where branch_id = $branch_id`)
    .pluck().all({ branch_id }));
  const watershed_participants_nr = watershed_count_Q(db, watershed_id);
  const message_nr = db.prepare(`
    select count(*) from messages where branch_id = $branch_id`)
    .pluck().get({ branch_id });
  // I need to figure out how to coordinate paging between the controller and
  // the model, at some point...
  const messages_page = messages_page_Q(db, branch_id);
  const progression = db.prepare(`
    select progression from branches where id = $branch_id`)
    .pluck().get({ branch_id });

  return Map({ branch_members, watershed_participants_nr, message_nr,
               messages_page, progression });
}

function summary(db, user_id, watershed_id) {
  return db.transaction(summaryQueries)(db, user_id, watershed_id);
}

function message_Q(db, details) {
  if (!(details.has('author_id') && details.has('content')
        && details.has('watershed_id'))) {
    throw Error('Missing key message details');
  }
  const author_id = details.get('author_id')
  const branch_id = join(db, author_id, details.get('watershed_id'));
  const new_message_info = db.prepare(`
    insert into messages (author_id, content, submitted, branch_id,
                          quoted_message_id, proposal_type, proposal_input)
      values ($author_id, $content, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
              $branch_id, $quoted_message_id, $proposal_type,
              $proposal_input)`).run({
    author_id, branch_id,
    content: details.get('content'),
    quoted_message_id: details.get('quoted_message_id'),
    proposal_type: details.get('proposal_type'),
    proposal_input: details.get('proposal_input'),
  });
  return new_message_info.lastInsertRowid;
}

function message(db, details) {
  return db.transaction(message_Q)(db, details);
}

module.exports = Object.freeze({ watershed, join, summary, message });
