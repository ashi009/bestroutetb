require('apollojs');

var format = require('util').format;

var chalk = require('chalk');
var ProgressBar = require('progress');

function Logger(options) {
  this.level = options.silent ? -1 : options.verbose;
}
$declare(Logger, {
  log: function(level, args) {
    console.log('%s %s %s',
        level,
        chalk.bold(chalk.magenta(args[0])),
        format.apply(null, Array.slice(args, 1)));
  },
  error: function() {
    if (this.level >= 0)
      this.log(chalk.red('erro'), arguments);
  },
  warn: function() {
    if (this.level >= 1)
      this.log(chalk.inverse(chalk.yellow('WARN')), arguments);
  },
  info: function() {
    if (this.level >= 1)
      this.log(chalk.green('info'), arguments);
  },
  verbose: function() {
    if (this.level >= 2)
      this.log(chalk.blue('verb'), arguments);
  },
  debug: function() {
    if (this.level >= 3)
      this.log(chalk.grey('dbug'), arguments);
  },
  getProgressBar: function(scope, message) {
    if (this.level >= 0)
      return new ProgressBar(format('%s %s %s', chalk.cyan('prog'),
          chalk.bold(chalk.magenta(scope)), message), 0);
  }
});

module.exports = Logger;
