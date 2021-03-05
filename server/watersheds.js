const config = require('config');
const { List, Map, fromJS } = require('immutable');

function watershed(db, options = {}) {
  let { branch_size, name, description } = options;
  if (branch_size === undefined) {
    if (config.has('branch_size')) {
      branch_size = config.get('branch_size');
    } else {
      branch_size = 5;
    }
  } else {
    branch_size = Number.parseInt(branch_size, 10);
    if (Number.isNaN(branch_size)) {
      throw Error('The branch size must be an integer.');
    }
  }

  const insert_query = db.prepare(`
    insert into watersheds (branch_size, name, description, updated) values (
      $branch_size, $name, $description,
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    )`);
  const info = insert_query.run({ branch_size, name, description });
  return info.lastInsertRowid;
}

function browse_Q(db, options = {}) {
  let { id, like_title, like_description } = options;

  let where_clause = '';
  if (id !== undefined) {
    where_clause = 'where watersheds.id = $id';
  }

  return fromJS(
    db.prepare(`
      select watersheds.id, watersheds.name, watersheds.description,
             watersheds.updated, branch_size,
             count(user_id) as nr_participants
        from watersheds left join branches
          on watersheds.id = watershed_id and head
        left join participation on branches.id = branch_id
          and end_status is null
        ${where_clause}
        group by watersheds.id`).all({ id }));
}

function browse(db, options = {}) {
  return db.transaction(browse_Q)(db, options);
}

function joinQueries(db, user_id, watershed_id) {
  user_id = Number.parseInt(user_id);
  watershed_id = Number.parseInt(watershed_id);
  const params = { user_id, watershed_id };
  const participation_rows = db.prepare(`
    select branch_id from participation
      inner join branches on participation.branch_id = branches.id
        and end_status is null
      where branch_id is not null
            and branches.head
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
   * the participation table with respect to a particular watershed.
   *
   * How much benefit would we gain from using this query directly as a
   * subquery in the `open_branches_rows` query that follows below?
   */
  const progression_rows = db.prepare(`
    select coalesce(target_branch_progression,
                    source_branch_progression + 1, 0) as progression,
           participation.branch_id,
           participation.branch_source_id
        -- We might want information like the following.  It's currently
        -- commented out, but note that it uses the \`max\` aggregate
        -- function as logical AND (which may be an SQLite-specific trick).
        --max(coalesce(target_branch.head, source_branch.head)) as head
      from users left join
        (select user_id, end_status, branch_id, branch_source_id,
                source_branch.progression as source_branch_progression,
                target_branch.progression as target_branch_progression
          from participation
          left join branches as source_branch
            on participation.branch_source_id = source_branch.id
          left join branches as target_branch
            on participation.branch_id = target_branch.id
          where coalesce(source_branch.watershed_id,
                         target_branch.watershed_id) = $watershed_id)
        as participation
        on users.id = participation.user_id and end_status is null
      where users.id = $user_id`).all(params);
  if (progression_rows.length !== 1) {
    throw Error(
      'Each user should have a unique progression within a watershed.')
  }

  /* Now, given a progression level, we want to be able to find the id of an
   * head branch in that watershed and at that progression level that is not
   * full.
   */
  const open_branches_rows = db.prepare(`
    select branches.id from branches
      inner join watersheds on watershed_id = watersheds.id
      where watershed_id = $watershed_id and head
            and progression = $progression
            and (
              select count(user_id) from participation
              where branch_id = branches.id and end_status is null
            ) < watersheds.branch_size `)
    .all({ watershed_id, progression: progression_rows[0].progression });

  let target_branch_id;
  if (open_branches_rows.length === 0) {
    // Create a new branch with the appropriate progression.
    const new_branch_info = db.prepare(`
      insert into branches (watershed_id, head, progression, updated)
        values ($watershed_id, true, $progression,
                strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`).run(
      { watershed_id, progression: progression_rows[0].progression });
    target_branch_id = new_branch_info.lastInsertRowid;
  } else {
    target_branch_id = open_branches_rows[0].id;
  }

  if (progression_rows[0].branch_id === null &&
      progression_rows[0].branch_source_id !== null) {
    db.prepare(`
      update participation set branch_id = $target_branch_id,
        last_seen = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      where branch_source_id = $branch_source_id
        and user_id = $user_id`)
      .run({
        user_id,
        target_branch_id,
        branch_source_id: progression_rows[0].branch_source_id
      });
  } else {
    const new_participation_info = db.prepare(`
      insert into participation (user_id, branch_id,
                                 branch_source_id, last_seen)
        values ($user_id, $target_branch_id, $branch_source_id,
                strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
      .run({
        user_id,
        target_branch_id,
        branch_source_id: progression_rows[0].branch_source_id
      });
  }
  return target_branch_id;
}

function join(db, user_id, watershed_id) {
  return db.transaction(joinQueries)(db, user_id, watershed_id);
}

function watershed_count_Q(db, watershed_id) {
  return db.prepare(`
    select count(*) from participation inner join branches on branch_id = id
      and end_status is null and head
      where watershed_id = $watershed_id`)
    .pluck().get({ watershed_id });
}

function messages_page_Q(db, branch_id) {
  // I need to figure out how to coordinate paging between the controller and
  // the model, at some point...
  return fromJS(db.prepare(`
    select * from messages where branch_id = $branch_id`)
    .all({ branch_id }));
}

function summaryQueries(db, user_id, watershed_id) {
  const watershed_rows = fromJS(db.prepare(`
    select * from watersheds where id = $watershed_id`)
    .all({ watershed_id }));
  if (watershed_rows.size !== 1) {
    throw Error('Exactly 1 watershed not found');
  }
  const branch_id = join(db, user_id, watershed_id);
  const branch_members = fromJS(db.prepare(`
    select user_id, name from participation left join users
      on user_id = users.id
      where branch_id = $branch_id
      and end_status is null`).all({ branch_id }));
  const nr_watershed_participants = watershed_count_Q(db, watershed_id);
  const nr_messages = db.prepare(`
    select count(*) from messages where branch_id = $branch_id`)
    .pluck().get({ branch_id });
  // I need to figure out how to coordinate paging between the controller and
  // the model, at some point...
  const messages_page = messages_page_Q(db, branch_id);
  const progression = db.prepare(`
    select progression from branches where id = $branch_id`)
    .pluck().get({ branch_id });

  return Map({ watershed_details: watershed_rows.get(0),
               branch_members, nr_watershed_participants, nr_messages,
               messages_page, progression });
}

function summary(db, user_id, watershed_id) {
  return db.transaction(summaryQueries)(db, user_id, watershed_id);
}

function message_Q(db, details) {
  let { author_id, content, watershed_id, quoted_message_id,
        proposal_type, proposal_input } = details;
  if (author_id === undefined || content === undefined
      || watershed_id === undefined) {
    console.log('message details:', details);
    throw Error('Missing key message details');
  }
  // Any proposal suggesting a representative with no other input is considered
  // to be a nomination for the author of the proposal.
  if (proposal_type === 'representative' && proposal_input === undefined) {
    proposal_input = String(author_id);
  }
  const branch_id = join(db, author_id, watershed_id);
  const new_message_info = db.prepare(`
    insert into messages (author_id, content, submitted, branch_id,
                          quoted_message_id, proposal_type, proposal_input)
      values ($author_id, $content, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
              $branch_id, $quoted_message_id, $proposal_type,
              $proposal_input)`).run({
    author_id, branch_id, content, quoted_message_id,
    proposal_type, proposal_input
  });
  return new_message_info.lastInsertRowid;
}

function message(db, details) {
  return db.transaction(message_Q)(db, details);
}

function reactions(db, message_id) {
  return fromJS(db.prepare(`
    select * from reactions where message_id = $message_id`)
    .all({ message_id }));
}

function branch_reactions_Q(db, user_id, watershed_id) {
  const branch_id = joinQueries(db, user_id, watershed_id);
  return fromJS(db.prepare(`
    select reactions.* from reactions inner join messages
      on message_id = messages.id where branch_id = $branch_id`)
    .all({ branch_id }));
}

function branch_reactions(db, user_id, watershed_id) {
  return db.transaction(branch_reactions_Q)(db, user_id, watershed_id);
}

function reaction_Q(db, details) {
  const { user_id, intent, message_id } = details;
  if (user_id === undefined || intent === undefined
      || message_id === undefined) {
    throw Error('Missing key reaction details');
  }

  // Check that the user with `user_id` is actually on the branch with the
  // message
  const participation = db.prepare(`
    select participation.branch_id from participation inner join messages
      on participation.branch_id = messages.branch_id
         and participation.user_id = $user_id
    where end_status is null and messages.id = $message_id`)
    .all({ user_id, message_id });
  if (participation.length === 0) {
    throw Error('Attempting to react to a message on a different branch');
  }

  const new_reaction_info = db.prepare(`
    insert into reactions (user_id, intent, message_id, submitted)
      values ($user_id, $intent, $message_id,
              strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`).run(details);

  // Adding reactions can trigger additional actions if they are the final
  // "+1" reaction on a representative proposal.
  const message_row = db.prepare(`
    select * from messages where id = $message_id`)
    .get({ message_id });
  if (message_row.proposal_type === 'representative') {
    const branch_id = participation[0].branch_id;

    const nr_affirmations = db.prepare(`
      select count(distinct reactions.user_id) as nr_affirmations
      from messages inner join reactions
        on messages.id = reactions.message_id
      where intent = '+1' and messages.id = $message_id`)
      .pluck().get({ message_id });
    const branch_size = db.prepare(`
      select branch_size from watersheds inner join branches
        on watersheds.id = branches.watershed_id
      where branches.id = $branch_id`).pluck().get({ branch_id });

    if (nr_affirmations === branch_size) {
      const representative_id = message_row.proposal_input;
      db.prepare(`
        update participation set end_status = 'representative'
          where user_id = $representative_id
                and branch_id = $branch_id`).run({
        representative_id, branch_id });
      db.prepare(`
        insert into participation (user_id, branch_source_id) values
          ($representative_id, $branch_id)`).run({
        representative_id, branch_id });
      db.prepare(`
        update branches set head = false,
          updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          where id = $branch_id`).run({ branch_id });
    }
  }
  return new_reaction_info.lastInsertRowid;
}

function reaction(db, details) {
  return reaction_Q(db, details);
  //return db.transaction(reaction_Q)(db, details);
}

module.exports = Object.freeze({
  watershed, browse, join, summary, message, reactions, branch_reactions,
  reaction });
