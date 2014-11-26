var fs = require('fs');
var lib = require('./lib.js');

var kNum = kGateways.length;

function TreeNode(prefix) {
  this.prefix = prefix || new lib.Prefix();
  this.count = [];
  for (var i=0; i < kNum; ++i){
    this.count[i] = Number.MAX_VALUE;
  }
  this.operation = [];
  for (var i=0; i < kNum; ++i){
    this.operation[i] = [0, 0];
  }
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
    for (i = 0; i < kNum; ++i){
      for (var j=0; j < kNum; ++j){
        for (var k=0; k < kNum; ++k){
          var newcount = left.count[j] + right.count[k] + 1;
          if (j == i) newcount--;
          if (k == i) newcount--; 
          if (count[i] >= newcount){
            count[i] = newcount;
            operation[i][0] = j;
            operation[i][1] = k;
          }
        }
      }
    }
  } else if (left) {
    for (i = 0; i < kNum; i++) {
      count[i] = left.count[i];
      operation[i][0] = i;
    }
  } else if (right) {
    for (i = 0; i < kNum; i++) {
      count[i] = right.count[i];
      operation[i][1] = i;
    }
  }
  if (root.color != undefined) {
    for (i = 0; i < kNum; ++i){
      if (i != root.color)
        count[i] = Number.MAX_VALUE;
    }
    if (left && right) {

    } else if (left) {
      for (i = 0; i < kNum; ++i){
        if (count[root.color] >= (left.count[i] + 1)){
          count[root.color] = left.count[i] + 1;
          operation[root.color][0] = i;
        }
      }
    } else if (right) {
      for (i = 0; i < kNum; ++i){
        if (count[root.color] >= (right.count[i] + 1)){
          count[root.color] = right.count[i] + 1;
          operation[root.color][1] = i;
        }
      }
    } else {
      count[root.color] = 1;
    }
  }
}

function dfsOutput(rules, root, lastColor, color) {
  if (lastColor === undefined) {
    color = 0;
    for (var i = 0; i < kNum; ++i)
      if (root.count[color] <= root.count[i])
        color = i;
  }
  if (color != lastColor) {
    rules.push({
      prefix: root.prefix.toIPv4(),
      mask: root.prefix.toMask(),
      length: root.prefix.length,
      gw: kGateways[color]
    });
  }
  var left = root.children[0];
  var right = root.children[1];
  if (left)
    dfsOutput(rules, left, color, root.operation[color][0]);
  if (right)
    dfsOutput(rules, right, color, root.operation[color][1]);
}

var root = lib.initiateTree(TreeNode);
var rules = [];

dfs(root);
dfsOutput(rules, root);

console.log('%j', rules);
console.error('Total: %d rules', Math.min.apply(null, root.count));
