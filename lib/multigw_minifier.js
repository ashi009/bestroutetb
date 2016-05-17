require('apollojs');

var Prefix = require('./prefix');
var Db = require('./db');

var kNothing = 0;
var kPullLeft = 1;
var kPullRight = 2;
var kPullBoth = kPullLeft | kPullRight;
var kPullData = 8;
var kPullNothing = 16;

var nColor = 0;
var colorToNet = {};

function createArray(count, init) {
  var arr = new Array(count);
  for (var i = 0; i < count; i++) {
    arr[i] = init;
  }
  return arr;
}

function TreeNode(prefix) {
  this.prefix = prefix || new Prefix();
  this.count = createArray(nColor, Number.MAX_VALUE);
  this.operation = createArray(nColor, kNothing);
  this.pushLeftColor = createArray(nColor, -1);
  this.pushRightColor = createArray(nColor, -1);
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
        node.children[bit] = new TreeNode(
            node.prefix.clone().append(bit));
      node = node.children[bit];
    }
    node.color = prefix.color;
  }
});

var kBlank = -1;

function dfs(root) {
  var count = root.count;
  var operation = root.operation;
  var pushLeftColor = root.pushLeftColor;
  var pushRightColor = root.pushRightColor;
  var left = root.children[0];
  var right = root.children[1];
  var i, j, k;
  if (left) dfs(left);
  if (right) dfs(right);
  if (left && right) {
    for (i = 0; i < nColor; i++) {
      if (count[i] > left.count[i] + right.count[i] - 1) {
        count[i] = left.count[i] + right.count[i] - 1;
        operation[i] = kPullBoth;
      }
      for (j = 0; j < nColor; j++) {
        if (i == j) {
          continue;
        }
        if (count[i] > left.count[i] + right.count[j]) {
          count[i] = left.count[i] + right.count[j];
          operation[i] = kPullLeft;
          pushRightColor[i] = j;
        }
        if (count[i] > left.count[j] + right.count[i]) {
          count[i] = left.count[j] + right.count[i];
          operation[i] = kPullRight;
          pushLeftColor[i] = j;
        }
        for (k = 0; k < nColor; k++) {
          if (i == k) {
            continue;
          }
          if (count[i] > left.count[j] + right.count[k] + 1) {
            count[i] = left.count[j] + right.count[k] + 1;
            operation[i] = kPullNothing;
            pushLeftColor[i] = j;
            pushRightColor[i] = k;
          }
        }
      }
    }
  } else if (left) {
    for (i = 0; i < nColor; i++) {
      count[i] = left.count[i];
      operation[i] = kPullLeft;
    }
  } else if (right) {
    for (i = 0; i < nColor; i++) {
      count[i] = right.count[i];
      operation[i] = kPullRight;
    }
  }
  if (root.color !== undefined) {
    count[root.color ^ 1] = Number.MAX_VALUE;
    if (left && right) {

    } else if (left) {
      for (i = 0; i < nColor; i++) {
        if (root.color == i) {
          continue;
        }
        if (left.count[root.color] > left.count[i] + 1) {
          count[root.color] = left.count[i] + 1;
          operation[root.color] = kPullNothing;
          pushLeftColor[root.color] = i;
        }
      }
    } else if (right) {
      for (i = 0; i < nColor; i++) {
        if (root.color == i) {
          continue;
        }
        if (right.count[root.color] > right.count[i] + 1) {
          count[root.color] = right.count[i] + 1;
          operation[root.color] = kPullNothing;
          pushRightColor[root.color] = i;
        }
      }
    } else {
      count[root.color] = 1;
      operation[root.color] = kPullData;
    }
  }
}

function dfsOutput(rules, root, lastColor, pushColor) {
  var color = kBlank;
  if (lastColor === undefined) {
    var minCount = Number.MAX_VALUE;
    root.count.forEach(function(count, c) {
      if (count < minCount) {
        minCount = count;
        color = c;
      }
    });
  } else if (pushColor !== undefined && pushColor >= 0) {
    color = pushColor;
  }
  if (color === kBlank) {
    color = lastColor;
  } else {
    rules.push({
      prefix: root.prefix.toIPv4(),
      mask: root.prefix.toMask(),
      length: root.prefix.length,
      gateway: colorToNet[color]
    });
  }
  var left = root.children[0];
  var right = root.children[1];
  if (left)
    dfsOutput(rules, left, color, root.pushLeftColor[color]);
  if (right)
    dfsOutput(rules, right, color, root.pushRightColor[color]);
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
  var networks = Object.keys(specs);
  nColor = networks.length;
  var root = new TreeNode();

  [].forEach.call(networks, function(network, color){
    colorToNet[color] = network;
    expandSpec(specs[network], color).forEach(function(prefix) {
      root.append(prefix);
    });
  });

  dfs(root);
  dfsOutput(rules, root);
  return rules;
}

module.exports = {
  minify: minify
};
