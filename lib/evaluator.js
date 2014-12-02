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

function reduce(count, partial) {
  if (!count)
    return partial;
  for (var gateway in partial) {
    if (!count[gateway])
      count[gateway] = {};
    var gatewayCount = count[gateway];
    var gatewayPartial = partial[gateway];
    for (var country in gatewayPartial) {
      if (!gatewayCount[country])
        gatewayCount[country] = 0;
      gatewayCount[country] += gatewayPartial[country];
    }
  }
  return count;
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
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    var node = root.append(new Prefix(rule.prefix, rule.length));
    node.gateway = rule.gateway;
  }
  var db = Db.getInstance();
  var countries = db.getCountryList();
  console.log(countries.length);
  for (var i = 0; i < countries.length; i++) {
    var country = countries[i];
    var prefixes = db.getPrefixesOfCountry(country);
    for (var j = 0; j < prefixes.length; j++) {
      var node = root.append(prefixes[j]);
      node.country = country;
    }
  }
  return dfs(root);
}

module.exports = {
  evaluate: evaluate
};
