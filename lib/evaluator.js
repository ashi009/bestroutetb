require('apollojs');

var Prefix = require('./prefix');
var Db = require('./db');

function TreeNode(prefix) {
  this.size = 0;
  this.country = null;
  this.gateway = null;
  this.children = [null, null];
}
$declare(TreeNode, {
  append: function(prefix) {
    var node = this;
    for (var i = 0; i < prefix.length; i++) {
      var bit = prefix.get(i);
      if (!node.children[bit])
        node.children[bit] = new TreeNode();
      node = node.children[bit];
    }
    node.size = prefix.size;
    return node;
  }
});

function reduce(prevCount, curCount) {
  if (!prevCount)
    return curCount;
  for (var gateway in curCount) {
    if (!prevCount[gateway]) {
      prevCount[gateway] = curCount[gateway];
    } else {
      var prevGatewayCount = prevCount[gateway];
      var curGatewayCount = curCount[gateway];
      for (var country in curGatewayCount) {
        if (!prevGatewayCount[country])
          prevGatewayCount[country] = curGatewayCount[country];
        else
          prevGatewayCount[country] += curGatewayCount[country];
      }
    }
  }
  return prevCount;
}

function accumulate(count) {
  var total = 0;
  for (var gateway in count) {
    var gatewayCount = count[gateway];
    for (var country in gatewayCount) {
      total += gatewayCount[country];
    }
  }
  return total;
}

function dfs(node, country, gateway) {
  var count;
  country = node.country || country;
  gateway = node.gateway || gateway;
  if (node.children[0])
    count = reduce(count, dfs(node.children[0], country, gateway));
  if (node.children[1])
    count = reduce(count, dfs(node.children[1], country, gateway));
  if (!count)
    count = {};
  if (country && gateway) {
    if (!count[gateway])
      count[gateway] = {};
    if (!count[gateway][country])
      count[gateway][country] = 0;
    count[gateway][country] += node.size - accumulate(count);
  }
  return count;
}

function evaluate(rules) {
  var root = new TreeNode();
  rules.forEach(function(rule) {
    root.append(new Prefix(rule.prefix, rule.length)).gateway = rule.gateway;
  });
  var db = Db.getInstance();
  var countries = db.getCountryList();
  countries.forEach(function(country) {
    var prefixes = db.getPrefixesOfCountry(country);
    for (var i = 0; i < prefixes.length; i++)
      root.append(prefixes[i]).country = country;
  });
  return {
    countries: countries,
    count: dfs(root)
  };
}

function generateCSV(report) {
  var csv = [];
  var count = report.count;
  var countries = report.countries.sort();
  var gateways = Object.keys(count).sort();
  csv.push('Country,' + gateways.join(','));
  for (var i = 0; i < countries.length; i++) {
    var line = [countries[i]];
    for (var j = 0; j < gateways.length; j++)
      line.push(count[gateways[j]][countries[i]] || 0);
    csv.push(line.join(','));
  }
  return csv.join('\n');
}

module.exports = {
  evaluate: evaluate,
  generateCSV: generateCSV
};
