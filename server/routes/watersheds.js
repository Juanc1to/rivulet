const express = require('express');
const { Map, List, Range } = require('immutable');

const watersheds = require('../watersheds');

const router = express.Router();

router.get('/:id', function (req, res) {
  const watershed_id = req.params.id;
  const summary = watersheds.summary(req.app.get('db'), watershed_id);
  let reports_by_level = Map();
  Range(0, summary.get('progression_level') + 1).reverse().forEach(
    function (level) {
      reports_by_level = reports_by_level.set(level, List());
    });
  summary.get('reports').forEach(function (report) {
    reports_by_level = reports_by_level.update(report.get('progression'),
      function (level_list) {
        report = report.update('submitted', function (submitted) {
          return submitted.replace('T', ' ');
        });
        return level_list.push(report);
      });
  });
  reports_by_level = reports_by_level.filter(
    function (report_list) {
      return report_list.size > 0;
    }).entrySeq().map(
    function (entry) {
      return Map({
        report_level_label: (entry[0] === 0
                             ? 'Entry branches'
                             : entry[0] === 1
                               ? 'Branches with 1 confluence'
                               : `Branches with ${entry[1]} confluences`),
        reports: entry[1]
      });
    });
  let params = Map({
    name: summary.getIn(['details', 'name']),
    description: summary.getIn(['details', 'description']),
    branch_size: summary.getIn(['details', 'branch_size']),
    nr_participants: summary.get('nr_participants'),
    progression_level: summary.get('progression_level'),
  });
  if (reports_by_level.size > 0) {
    params = params.setIn(['reports?', 'reports_by_level'], reports_by_level);
  }
  res.render('watershed_summary', params.toJS());
});

module.exports = router;
