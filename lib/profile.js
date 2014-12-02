require('apollojs');

var pathUtil = require('path');
var fs = require('fs');

var async = require('async');

var Formatter = require('./formatter');

var pFormatterNames;

function Profile(targets) {
  this.targets = targets;
  this.resolved = null;
}
$declare(Profile, {
  /**
   * resolve targets to output pathes
   * @param  {string} output output path
   * @return {object}        resolved targets
   */
  resolveTargets: function(output) {
    var resolved = {};
    for (var name in this.targets) {
      var path = output;
      if (name != '%') {
        var ext = pathUtil.extname(path);
        var basename = pathUtil.basename(path, ext);
        var dirname = pathUtil.dirname(path);
        if (basename && ext)
          path = pathUtil.join(dirname, basename +
              pathUtil.basename(name, pathUtil.extname(name)) + ext);
        else
          path = pathUtil.join(path, name);
      }
      resolved[name] = path;
    }
    this.resolved = resolved;
    return resolved;
  },
  /**
   * generate a target
   * @param  {string} name    target name
   * @param  {[Rule]} rules   rule set
   * @param  {object} options options for formatter
   */
  generate: function(name, rules, options) {
    var target = this.targets[name];
    var path = this.resolved[name];
    var formatter = new this.targets[name].Formatter(options);
    fs.writeFileSync(path, formatter.format(rules));
    if (target.mode)
      fs.chmodSync(path, target.mode);
  }
});
$define(Profile, {
  /**
   * get available profiles
   * @return {[string]} supported profiles
   */
  getAvailableNames: function() {
    if (pFormatterNames)
      return pFormatterNames;
    pFormatterNames = fs.readdirSync(pathUtil.resolve(__dirname, '../profile'))
        .map(function(name) {
          return pathUtil.basename(name, '.js');
        });
    return pFormatterNames;
  },
  /**
   * load a profile
   * @param {string}   name profile name
   * @return {Profile} a profile instanc
   */
  load: function(name) {
    var profile, err;
    try {
      profile = require('../profile/' + name);
    } catch(e) {
      err = e;
    }
    if (!profile)
      try {
        profile = require(name);
      } catch(e) {
        err = e;
      }
    if (profile)
      return new Profile(profile(Formatter));
    throw err;
  }
});

module.exports = Profile;
