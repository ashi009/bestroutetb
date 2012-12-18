var fs = require('fs');
var lib = require('./lib.js');

var kNothing = 0;
var kPullLeft = 1;
var kPullRight = 2;
var kPullBoth = kPullLeft | kPullRight;
var kPullData = 8;
var kPullNothing = 16;

function TreeNode(prefix) {
  this.prefix = prefix || new lib.Prefix();
  this.count = [Number.MAX_VALUE, Number.MAX_VALUE];
  this.operation = [kNothing, kNothing];
  this.children = [null, null];
}
$inherit(TreeNode, lib.TreeNode);

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
      gw: color == kRed ? 'net' : 'vpn'
    });
  }
  var left = root.children[0];
  var right = root.children[1];
  if (left)
    dfsOutput(rules, left, color, (root.operation[color] & kPullLeft) === 0);
  if (right)
    dfsOutput(rules, right, color, (root.operation[color] & kPullRight) === 0);
}

var root = lib.initiateTree(TreeNode);
var rules = [];

dfs(root);
dfsOutput(rules, root);

console.log('%j', rules);
console.error('Total: %d rules', Math.min.apply(null, root.count));
