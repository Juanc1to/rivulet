function drop_all_tables_factory(sqlite) {
  return function () {
    const table_names = sqlite.prepare(
      "select name from sqlite_schema where type = 'table'").pluck().all();
    table_names.forEach(function drop(table_name) {
      sqlite.prepare(`drop table ${table_name}`).run();
    });
    sqlite.close();
  };
}

function delete_from_each_table_factory(sqlite) {
  return sqlite.transaction(function () {
    const table_names = sqlite.prepare(
      "select name from sqlite_schema where type = 'table'").pluck().all();
    table_names.forEach(function drop(table_name) {
      sqlite.prepare(`delete from ${table_name}`).run();
    });
  });
}

module.exports = Object.freeze({
  drop_all_tables_factory, delete_from_each_table_factory });
