const { fromJS } = require('immutable');

const tables = fromJS({
  users: `
    create table users (
      id integer primary key,
      name text,
      email text,
      anonymous_token text,
      updated timestamp with time zone)`,
  watersheds: `
    create table watersheds (
      id integer primary key,
      branch_size integer,
      name text,
      description text,
      updated timestamp with time zone)`,
  branches: `
    create table branches (
      id integer primary key,
      watershed_id integer,
      conclusions text,
      active boolean,
      progression integer,
      updated timestamp with time zone)`,
  participation: `
    create table participation (
      user_id integer,
      branch_id integer,
      branch_source_id integer,
      last_seen timestamp with time zone,
      override boolean)`,
  messages: `
    create table messages (
      id integer primary key,
      author_id integer,
      message text,
      submitted timestamp with time zone,
      branch_id integer,
      quoted_message_id integer,
      proposal_type text,
      proposal_input text)`,
  reactions: `
    create table reactions (
      id integer primary key,
      user_id integer,
      intent text,
      message_id integer,
      submitted timestamp with time zone)`,
});

function initialize(sqlite) {
  const table_statement = sqlite.prepare(
    'select * from pragma_table_info($table)');

  tables.keySeq().forEach(function check_and_create(table_name) {
    if (table_statement.get({ table: table_name }) === undefined) {
      sqlite.prepare(tables.get(table_name)).run();
    }
  });

  return sqlite;
}

module.exports = Object.freeze({ initialize })
