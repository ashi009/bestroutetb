#! /usr/bin/env node

require('apollojs');

var fs = require('fs');
var util = require('util');
var pathUtil = require('path');
var packageInfo = require('./package');

var async = require('async');
var yargs = require('yargs');
var chalk = require('chalk');

var Db = require('./lib/db');
var Logger = require('./lib/logger');
var Minifier = require('./lib/minifier');
var Profile = require('./lib/profile');
var Evaluator = require('./lib/evaluator');

var argv = yargs
    .usage('Usage: $0 [options]')
    .options('route.net', {
      string: true,
      default: 'CN',
      describe: 'Subnets that should be routed to ISP gateway'
    })
    .options('route.vpn', {
      string: true,
      default: 'US,GB,JP,HK',
      describe: 'Subnets that should be routed to VPN gateway'
    })
    .options('p', {
      alias: 'profile',
      string: true,
      describe: 'Output format profile: `' +
          Profile.getAvailableNames().join('`, `') + '`'
    })
    .config('c')
    .options('c', {
      alias: 'config',
      describe: 'Configuration file path'
    })
    .options('o', {
      alias: 'output',
      string: true,
      describe: 'Output file path'
    })
    .options('r', {
      alias: 'report',
      string: true,
      describe: 'Report file path'
    })
    .options('header', {
      string: true,
      describe: 'Header of the output file'
    })
    .options('footer', {
      string: true,
      describe: 'Footer of the output file'
    })
    .options('rule-format', {
      string: true,
      describe: 'String used to format a rule when `--profile=custom`'
    })
    .options('gateway.net', {
      string: true,
      describe: 'Substitute for `%gw` when rule is using ISP gateway'
    })
    .options('gateway.vpn', {
      string: true,
      describe: 'Substitute for `%gw` when rule is using VPN gateway'
    })
    .options('default-gateway', {
      boolean: true,
      default: true,
      describe: 'Output directive for default route (0.0.0.0/0)'
    })
    .options('group-gateway', {
      boolean: true,
      default: undefined,
      describe: 'Group rules by gateway'
    })
    .options('group-header', {
      string: true,
      describe: 'Header of each group'
    })
    .options('group-footer', {
      string: true,
      describe: 'Footer of each group'
    })
    .options('group-name.net', {
      string: true,
      describe: 'Substitute for `%name` when group is route to ISP gateway'
    })
    .options('group-name.vpn', {
      string: true,
      describe: 'Substitute for `%name` when group is route to VPN gateway'
    })
    .options('f', {
      alias: 'force',
      boolean: true,
      describe: 'Force to overwrite existing files'
    })
    .options('update', {
      boolean: true,
      default: undefined,
      describe: 'Force update delegation data, `--no-update` to use stale data'
    })
    .options('v', {
      alias: 'verbose',
      count: true,
      describe: 'Verbose output'
    })
    .options('s', {
      alias: 'silent',
      boolean: true,
      describe: 'Silent mode'
    })
    .addHelpOpt('h')
    .alias('h', 'help')
    .version(util.format('%s %s (%s)\n', packageInfo.name, packageInfo.version,
        Db.getInstance().version), 'V')
    .alias('V', 'version')
    .check(function(argv) {
      if (argv.verbose && argv.silent)
        throw '`--verbose` conflicts with `--silent`';
      if (argv.output && !argv.profile)
        throw '`--profile` must be specified when generating output';
    })
    .check(function(argv) {
      if (argv.profile &&
          Profile.getAvailableNames().indexOf(argv.profile) === -1) {
        var path = pathUtil.resolve(argv.profile);
        if (!fs.existsSync(path))
          throw 'Cannot find given profile.';
        argv.profile = path;
      }
    })
    .check(function(argv) {
      for (var gateway in argv.route)
        argv.route[gateway] = []
            .concat(argv.route[gateway])
            .join(',')
            .split(',');
    })
    .wrap(process.stdout.columns)
    .argv;

var logger = new Logger({
  verbose: argv.verbose,
  silent: argv.silent
});

function writeFileSync(scope, path, content) {
  logger.info(scope, 'generating %s', chalk.cyan(path));
  if (fs.existsSync(path)) {
    if (!argv.force)
      return logger.error(scope,
          '%s already exists, use `-f` to continue', chalk.cyan(path));
    logger.warn(scope, 'will overwrite %s', chalk.cyan(path));
  }
  if (Function.isFunction(content))
    content = content();
  var mode;
  fs.writeFileSync(path, content);
  if (content.mode)
    fs.chmodSync(path, content.mode);
  logger.info(scope, 'created %s', chalk.cyan(path));
}

var jobs = {
  // db
  db: function(callback) {
    var scope = 'db';
    logger.info(scope, 'loading');
    if (argv.update === false)
      logger.warn(scope, 'using stale data');
    else if (argv.update === true)
      logger.info(scope, 'force update');
    Db.update({
      force: argv.update === true,
      useStale: argv.update === false,
      progressBar: logger.getProgressBar(scope,
          'updating... :percent :currentB/:totalB :etas')
    }, function(err) {
      if (err) {
        err.scope = scope;
        return callback(err);
      }
      logger.info(scope, 'version %s', Db.getInstance().version);
      callback();
    });
  },
  // minify
  rules: ['db', function(callback) {
    var scope = 'minify';
    logger.info(scope, 'generating route table');
    logger.verbose(scope, 'options %j', argv.route);
    try {
      var rules = Minifier.minify(argv.route);
      logger.info(scope, '%d rules generated', rules.length);
      callback(null, rules);
    } catch(err) {
      err.scope = scope;
      callback(err);
    }
  }],
  // profile
  profile: ['db', function(callback) {
    if (!argv.profile)
      return callback();
    var scope = 'profile';
    logger.info(scope, 'loading');
    logger.verbose(scope, 'using %s', argv.profile);
    try {
      var profile = Profile.load(argv.profile);
      logger.info(scope, 'loaded');
      callback(null, profile);
    } catch(err) {
      err.scope = scope;
      callback(err);
    }
  }],
  // generate
  output: ['rules', 'profile', function(callback, results) {
    if (!argv.output)
      return callback();
    var scope = 'profile:' + argv.profile;
    var options = {
      header: argv.header,
      footer: argv.footer,
      ruleFormat: argv.ruleFormat,
      gateway: argv.gateway,
      defaultGateway: argv.defaultGateway,
      groupGateway: argv.groupGateway,
      groupHeader: argv.groupHeader,
      groupFooter: argv.groupFooter,
      groupName: argv.groupName
    };
    logger.debug(scope, 'options %j', options);
    var profile = results.profile;
    var resolved = profile.resolveTargets(argv.output);
    logger.verbose(scope, 'resolved targets %j', resolved);
    for (var name in resolved) {
      try {
        if (fs.existsSync(resolved[name])) {
          if (argv.force)
            logger.warn(scope, 'will overwrite %s', chalk.cyan(resolved[name]));
          else
            throw $error('%s already exists, use `-f` to continue',
                chalk.cyan(resolved[name]));
        }
        logger.info(scope, 'generating %s', chalk.cyan(resolved[name]));
        profile.generate(name, results.rules, options);
        logger.info(scope, 'created %s', chalk.cyan(resolved[name]));
      } catch(err) {
        err.scope = scope;
        return callback(err);
      }
    }
    callback();
  }],
  // report
  report: ['rules', function(callback, results) {
    if (!argv.report)
      return callback();
    var scope = 'eval';
    logger.info(scope, 'analysing rules');
    var report = Evaluator.evaluate(results.rules);
    try {
      writeFileSync(scope, argv.report,
          Evaluator.generateCSV.bind(Evaluator, report));
    } catch(err) {
      err.scope = scope;
      return callback(err);
    }
    callback();
  }]
};

logger.debug('cli', 'argv parsed %j', argv);

var startTime = new Date();
logger.verbose('cli', 'start at %s', startTime);

async.auto(jobs, function(err) {
  if (err) {
    logger.error(err.scope, err.message);
    logger.debug(err.scope, err.stack);
    process.exit(1);
  } else {
    var endTime = new Date();
    logger.info('cli', 'finished at %s, %ds', endTime,
        (endTime - startTime) / 1000);
  }
});
