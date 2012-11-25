var fs = require('fs');
var lib = require('./lib.js');
var Prefix = lib.Prefix;

fs.readFileSync('ipv4-address-space.txt').toString()
  .split('\n')
  .filter(function(line) {
    return /^\s+\d{3}\/\d.+(?:ALLOCATED|LEGACY)/.test(line) && !/APNIC/.test(line);
  }).map(function(line) {
    var match = /\s+(\d{3})\/(\d)\s+(.+)\d{4}-\d{2}.+(ALLOCATED|LEGACY)/.exec(line);
    if (match) {
      var prefix = new Prefix(match[1] + '.0.0.0', parseInt(match[2]));
      prefix.country = match[3].trim();
      prefix.status = match[4];
      console.log(prefix.toIPv4() + '/' + prefix.length);
    } else {
      console.error('!!!');
    }
  });

