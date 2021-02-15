const { Map, Set } = require('immutable');
const app = require('../../app');
// Eventually this will be routed through a runtime configuration (in theory):
const sqlite = app.get('db');

const { drop_all_tables_factory } = require('./util');

const field_statement = sqlite.prepare(
  'select * from pragma_table_info($table) where name = $column_name'
);

function has_table_structure(table_name, table_columns) {
  const parameter_binding = Map({ table: table_name });
  table_columns.keySeq().forEach(function column_test(name) {
    const rows = field_statement.all(
      parameter_binding.set('column_name', name).toObject());
    expect(rows.length).toBe(1);
  });
}

afterAll(drop_all_tables_factory(sqlite));

describe('SQLite3 database schema', function () {
  it('has a users table', function () {
    const table_columns = Set(
      [
        'id',
        'email',
        'name',
        'anonymous_token',
        'updated',
      ]
    );
    has_table_structure('users', table_columns);
  });

  it('has a watersheds table', function () {
    const table_columns = Set(
      [
        'id',
        'branch_size',
        'name',
        'description',
        'updated',
      ]
    );
    has_table_structure('watersheds', table_columns);
  });

  it('has a branches table', function () {
    const table_columns = Set(
      [
        'id',
        'watershed_id',
        'conclusions',
        'head',
        'progression',
        'updated',
      ]
    );
    has_table_structure('branches', table_columns);
  });

  it('has a participation table', function () {
    const table_columns = Set(
      [
        'user_id',
        'branch_id',
        'branch_source_id',
        'last_seen',
        'override',
      ]
    );
    has_table_structure('participation', table_columns);
  });

  it('has a messages table', function () {
    const table_columns = Set(
      [
        'id',
        'author_id',
        'content',
        'submitted',
        'branch_id',
        'quoted_message_id',
        'proposal_type',
        'proposal_input',
      ]
    );
    has_table_structure('messages', table_columns);
  });

  it('has a reactions table', function () {
    const table_columns = Set(
      [
        'id',
        'user_id',
        'intent',
        'message_id',
        'submitted',
      ]
    );
    has_table_structure('reactions', table_columns);
  });
});
