var Prefix = require('./prefix');
var Db = require('./db');

var kNothing = 0;
var kPullLeft = 1;
var kPullRight = 2;
var kPullBoth = kPullLeft | kPullRight;
var kPullData = 8;
var kPullNothing = 16;

var Prefix = require('./prefix');

function TreeNode(prefix) {
  this.prefix = prefix || new Prefix();
  this.count = [Number.MAX_VALUE, Number.MAX_VALUE];
  this.operation = [kNothing, kNothing];
  this.children = [null, null];
}
$declare(TreeNode, {
  append: function(prefix) {
    if (prefix.color === undefined)
      return;
    var node = this;
    for (var i = 0; i < prefix.length; i++) {
      node.count[prefix.color]++;
      var bit = prefix.get(i);
      if (!node.children[bit])
        node.children[bit] = new this.constructor(
            node.prefix.clone().append(bit));
      node = node.children[bit];
    }
    node.color = prefix.color;
  }
});

var kBlank = -1;
var kRed = 0;
var kBlue = 1;

function dfs(root) {
  var count = root.count;
  var operation = root.operation;
  var left = root.children[0];
  var right = root.children[1];
  var i;
  if (left) dfs(left);
  if (right) dfs(right);
  if (left && right) {
    for (i = 0; i < 2; i++) {
      if (count[i] > left.count[i] + right.count[i] - 1) {
        count[i] = left.count[i] + right.count[i] - 1;
        operation[i] = kPullBoth;
      }
      if (count[i] > left.count[i] + right.count[i^1]) {
        count[i] = left.count[i] + right.count[i^1];
        operation[i] = kPullLeft;
      }
      if (count[i] > left.count[i^1] + right.count[i]) {
        count[i] = left.count[i^1] + right.count[i];
        operation[i] = kPullRight;
      }
      if (count[i] > left.count[i^1] + right.count[i^1] + 1) {
        count[i] = left.count[i^1] + right.count[i^1] + 1;
        operation[i] = kPullNothing;
      }
    }
  } else if (left) {
    for (i = 0; i < 2; i++) {
      count[i] = left.count[i];
      operation[i] = kPullLeft;
    }
  } else if (right) {
    for (i = 0; i < 2; i++) {
      count[i] = right.count[i];
      operation[i] = kPullRight;
    }
  }
  if (root.color !== undefined) {
    count[root.color ^ 1] = Number.MAX_VALUE;
    if (left && right) {

    } else if (left) {
      if (left.count[root.color] > left.count[root.color ^ 1] + 1) {
        count[root.color] = left.count[root.color ^ 1] + 1;
        operation[root.color] = kPullNothing;
      }
    } else if (right) {
      if (right.count[root.color] > right.count[root.color ^ 1] + 1) {
        count[root.color] = right.count[root.color ^ 1] + 1;
        operation[root.color] = kPullNothing;
      }
    } else {
      count[root.color] = 1;
      operation[root.color] = kPullData;
    }
  }
}

function dfsOutput(rules, root, lastColor, revertColor) {
  var color = kBlank;
  if (lastColor === undefined) {
    if (root.count[kRed] < root.count[kBlue])
      color = kRed;
    else
      color = kBlue;
  } else if (revertColor) {
    color = lastColor ^ 1;
  }
  if (color === kBlank) {
    color = lastColor;
  } else {
    rules.push({
      prefix: root.prefix.toIPv4(),
      mask: root.prefix.toMask(),
      length: root.prefix.length,
      gateway: color == kRed ? 'net' : 'vpn'
    });
  }
  var left = root.children[0];
  var right = root.children[1];
  if (left)
    dfsOutput(rules, left, color, (root.operation[color] & kPullLeft) === 0);
  if (right)
    dfsOutput(rules, right, color, (root.operation[color] & kPullRight) === 0);
}

var kCountryCodePattern = /^[a-z]{2}$/i;

function expandSpec(spec, color) {
  var prefixes = [];
  var db = Db.getInstance();
  spec.forEach(function(desc) {
    if (kCountryCodePattern.test(desc)) {
      [].push.apply(prefixes, db.getPrefixesOfCountry(desc));
    } else {
      prefixes.push(Prefix.parse(desc));
    }
  });
  prefixes.forEach(function(prefix) {
    prefix.color = color;
  });
  return prefixes;
}

function minify(specs) {
  var rules = [];
  var root = new TreeNode();

  expandSpec(specs.net, kRed).forEach(function(prefix) {
    root.append(prefix);
  });
  expandSpec(specs.vpn, kBlue).forEach(function(prefix) {
    root.append(prefix);
  });

  dfs(root);
  dfsOutput(rules, root);
  return rules;
}

module.exports = minify;
