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

module.exports = Object.freeze({ drop_all_tables_factory });
