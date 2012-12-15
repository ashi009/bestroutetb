var fs = require('fs');
var lib = require('./lib.js');

var opts = lib.options;
var RouteTable = lib.RouteTable;
var countryNames = lib.getCountryNames();

lib.getRulesFromInput(function(rules) {

  var routeTable = new RouteTable();
  routeTable.add('0.0.0.0', 0, opts.default || 'default');

  rules.forEach(function(rule) {
    routeTable.add(rule.prefix, rule.length, rule.gw);
  });

  var countries = {};
  var gateways = {};

  lib.getAPNICDelegation().forEach(function(prefix) {
    var gateway = routeTable.route(prefix.toIPv4());
    if (opts.verbose) {
      console.log("%s\t%s\t%d\t%s\t%s", prefix.toIPv4(),
          prefix.toMask(), prefix.size, prefix.country, gateway);
    }
    if (!gateways.hasOwnProperty(gateway))
      gateways[gateway] = {};
    if (!gateways[gateway].hasOwnProperty(prefix.country))
      gateways[gateway][prefix.country] = 0;
    gateways[gateway][prefix.country] += prefix.size;
    if (!countries.hasOwnProperty(prefix.country))
      countries[prefix.country] = {
        total: 0,
        gateways: {}
      };
    var profile = countries[prefix.country];
    profile.total += prefix.size;
    if (!profile.gateways.hasOwnProperty(gateway))
      profile.gateways[gateway] = 0;
    profile.gateways[gateway] += prefix.size;
  });

  lib.getNonAPNICDelegation().forEach(function(prefix) {
    var gateway = routeTable.route(prefix.toIPv4());
    if (opts.verbose) {
      console.log("%s\t%s\t%d\t%s\t%s", prefix.toIPv4(),
          prefix.toMask(), prefix.size, prefix.admin, gateway);
    }
    if (!gateways.hasOwnProperty(gateway))
      gateways[gateway] = {};
    if (!gateways[gateway].hasOwnProperty(prefix.admin))
      gateways[gateway][prefix.admin] = 0;
    gateways[gateway][prefix.admin] += prefix.size;
    if (!countries.hasOwnProperty(prefix.admin))
      countries[prefix.admin] = {
        total: 0,
        gateways: {}
      };
    var profile = countries[prefix.admin];
    profile.total += prefix.size;
    if (!profile.gateways.hasOwnProperty(gateway))
      profile.gateways[gateway] = 0;
    profile.gateways[gateway] += prefix.size;
  });

  for (var gateway in gateways) {
    var profile = gateways[gateway];
    console.log('%s:', gateway);
    for (var country in profile)
      console.log('    %s\t%s%\t%d',
          countryNames.getLocalString(country),
          ((profile[country] / countries[country].total) * 100).toFixed(2),
          profile[country]);
  }
  for (var country in countries) {
    var profile = countries[country];
    console.log('%s:', countryNames.getLocalString(country));
    for (var gateway in profile.gateways)
      console.log('    %s\t%s%\t%d',
          gateway,
          ((profile.gateways[gateway] / profile.total) * 100).toFixed(2),
          profile.gateways[gateway]);
  }

});
