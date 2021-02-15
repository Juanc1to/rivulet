const { fromJS } = require('immutable');

const create_items = fromJS({
  users: `
    create table if not exists users (
      id integer primary key,
      name text,
      email text,
      anonymous_token text,
      updated timestamp with time zone)`,
  watersheds: `
    create table if not exists watersheds (
      id integer primary key,
      branch_size integer,
      name text,
      description text,
      updated timestamp with time zone)`,
  branches: `
    create table if not exists branches (
      id integer primary key,
      watershed_id integer,
      conclusions text,
      head boolean,
      progression integer,
      updated timestamp with time zone)`,
  participation: `
    create table if not exists participation (
      user_id integer,
      branch_id integer,
      branch_source_id integer,
      last_seen timestamp with time zone,
      override boolean)`,
  participation_index: `
    create index if not exists participation_index on participation (
      user_id, branch_id, branch_source_id)`,
  messages: `
    create table if not exists messages (
      id integer primary key,
      author_id integer,
      content text,
      submitted timestamp with time zone,
      branch_id integer,
      quoted_message_id integer,
      proposal_type text,
      proposal_input text)`,
  reactions: `
    create table if not exists reactions (
      id integer primary key,
      user_id integer,
      intent text,
      message_id integer,
      submitted timestamp with time zone)`,
});

function initialize(sqlite) {
  return sqlite.transaction(function initializeQueries() {
    create_items.keySeq().forEach(function create(item_name) {
      sqlite.prepare(create_items.get(item_name)).run();
    });

    return sqlite;
  })();
}

module.exports = Object.freeze({ initialize })
