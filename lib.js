var path = require('path');
var fs = require('fs');

var kRootPath = path.dirname(module.filename);

function $define(object, prototype) {
  var setterGetterPattern = /^(set|get)([A-Z])(.*)/;
  var setterGetters = {};
  for (var key in prototype) {
    var matches = setterGetterPattern.exec(key);
    if (matches) {
      var name = matches[2].toLowerCase() + matches[3];
      if (!setterGetters.hasOwnProperty(name))
        setterGetters[name] = {};
      setterGetters[name][matches[1]] = prototype[key];
    }
    Object.defineProperty(object, key, {
      value: prototype[key],
      writeable: false
    });
  }
  Object.defineProperties(object, setterGetters);
}
function $declare(object, prototype) {
  object.prototype.constructor = object;
  $define(object.prototype, prototype);
}
function $inherit(type, parent, proto) {
  type.prototype = {
    constructor: type,
    __proto__: parent.prototype
  };
  if (proto) $define(type.prototype, proto);
}

$define(global, {
  $define: $define,
  $declare: $declare,
  $inherit: $inherit
});

$define(String.prototype, {
  format: function() {
    var args = arguments;
    return this.replace(/%(([a-zA-Z]\w*)|(\d+))\b/g, function(all, key, name, index) {
      if (index !== undefined)
        return args[parseInt(index, 10)];
      for (var i = 0; i < args.length; i++)
        if (args[i].hasOwnProperty(name))
          return args[i][name];
      return '';
    });
  }
});

var opts = {}, flags = {};
(function() {

for (var i = 0, argv = process.argv.slice(2); i < argv.length; i++) {
  var name, value;
  if (argv[i].substr(0, 2) === '--') {
    var index = argv[i].indexOf('=');
    if (index > -1) {
      name = argv[i].substring(2, index);
      value = argv[i].substr(index + 1);
    } else {
      name = argv[i].substr(2);
      value = argv[++i];
    }
    opts[name] = value;
    var match = /(y|yes|true|1)|(n|no|false|0)/.exec(value);
    if (match)
      flags[name] = match[1] ? true : false;
  } else {
    opts._ = argv[i];
  }
}

})();

function toIPv4(v) {
  var parts = [];
  for (var i = 24; i >= 0; i -= 8)
    parts.push((v >>> i) & 0xff);
  return parts.join('.');
}

function parseIPv4(ip) {
  return ip.split('.').reduce(function(lhv, rhv) {
    return (lhv << 8) | parseInt(rhv, 10);
  }, 0);
}

function getMaskLength(mask) {
  mask = ~mask;
  var n = 32;
  if (mask & 0xffff0000) n -= 16, mask >>>= 16;
  if (mask & 0xff00) n -= 8, mask >>= 8;
  if (mask & 0xf0) n -= 4, mask >>= 4;
  if (mask & 0xc) n -= 2, mask >>= 2;
  if (mask & 0x2) n--, mask >>= 1;
  if (mask) n--;
  return n;
}

function Prefix(prefix, mask) {
  if (prefix instanceof Prefix)
    return prefix.clone();
  if (mask === undefined) {
    prefix = prefix || '';
    this.prefix = parseInt(prefix, 2) << (32 - prefix.length);
    this.length = prefix.length;
  } else {
    this.prefix = parseIPv4(prefix);
    this.length = typeof mask === 'number' ? mask : getMaskLength(parseIPv4(mask));
  }
}
$declare(Prefix, {
  toString: function() {
    if (this.length < 31) {
      var padded = (this.prefix >>> (32 - this.length)) | (1 << this.length);
      return padded.toString(2).substr(1);
    }
    var paddedHi = (this.prefix >>> 16) | (1 << 16);
    var paddedLo = ((this.prefix & 0xffff) >> (32 - this.length)) | (1 << (this.length - 16));
    return paddedHi.toString(2).substr(1) + paddedLo.toString(2).substr(1);
  },
  toIPv4: function() {
    return toIPv4(this.prefix);
  },
  toMask: function() {
    return toIPv4(this.mask);
  },
  append: function(bit) {
    console.assert(this.length < 32);
    this.length++;
    this.prefix |= bit << (32 - this.length);
    return this;
  },
  pop: function() {
    console.assert(this.length > 0);
    this.prefix &= ~(1 << (32 - this.length));
    this.length--;
    return this;
  },
  get: function(index) {
    if (this.prefix & (0x80000000 >>> index))
      return 1;
    return 0;
  },
  clone: function() {
    var p = new Prefix();
    p.length = this.length;
    p.prefix = this.prefix;
    return p;
  },
  getMask: function() {
    if (this.length === 0)
      return 0;
    return 0x80000000 >> (this.length - 1);
  },
  getSize: function() {
    return 1 << (32 - this.length);
  }
});

function RouteTable() {
  this.table = [];
  for (var i = 0; i <= 32; i++)
    this.table.push({});
}
$declare(RouteTable, {
  add: function(prefix, length, gateway) {
    console.assert(length >= 0 && length <= 32);
    this.table[length][parseIPv4(prefix)] = gateway;
  },
  route: function(ip) {
    ip = parseIPv4(ip);
    for (var i = 32; i > 0; i--) {
      var maskedIp = ip & (0xffffffff << (32 - i));
      if (this.table[i].hasOwnProperty(maskedIp))
        return this.table[i][maskedIp];
    }
    if (this.table[0].hasOwnProperty(0))
      return this.table[0][0];
    return null;
  }
});

function TreeNode(prefix) {
  this.prefix = prefix || new Prefix();
  this.count = [0, 0];
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
$define(global, {
  kBlank: -1,
  kRed: 0,
  kBlue: 1
});

function getRulesFromInput(callback) {
  if (opts._) {
    callback(JSON.parse(fs.readFileSync(opts._)));
  } else {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    var data = '';
    process.stdin.on('data', function(chunk) {
      data += chunk;
    });
    process.stdin.on('end', function() {
      callback(JSON.parse(data));
    });
  }
}

function getRegionalDelegation(region) {
  return fs.readFileSync(kRootPath + '/data/delegated-' + region + '-latest')
      .toString()
      .split('\n')
      .filter(function(v) {
        return (/^[a-z]+\|[A-Z]{2}\|ipv4\|\d/).test(v);
      }).map(function(v) {
        var desc = v.split('|');
        var mask = getMaskLength(~(parseInt(desc[4], 10) - 1));
        var prefix = new Prefix(desc[3], mask);
        prefix.country = desc[1];
        return prefix;
      });
}

function getAllRegionalDelegation() {
  return ['apnic', 'arin', 'ripencc', 'lacnic']
      .map(getRegionalDelegation).reduce(function(lhv, rhv) {
        return lhv.concat(rhv);
      }, []);
}

function getNonAPNICDelegation() {
  return fs.readFileSync(kRootPath + '/data/ipv4-address-space')
      .toString()
      .split('\n')
      .filter(function(line) {
        return (/^\s+\d{3}\/\d.+(?:ALLOCATED|LEGACY)/).test(line) && !(/APNIC/).test(line);
      }).map(function(line) {
        var match = (/\s+(\d{3})\/(\d)\s+(.+)\d{4}-\d{2}.+(ALLOCATED|LEGACY)/).exec(line);
        var prefix = new Prefix(match[1] + '.0.0.0', parseInt(match[2], 10));
        prefix.admin = match[3].trim();
        prefix.status = match[4].toLowerCase();
        return prefix;
      });
}

function I18nStrings(data, locales) {
  this.data = data;
  this.locales = locales;
  this.locale = locales.indexOf('zh-cn');
  if (this.locale < 0)
    this.locale = 0;
}
$define(I18nStrings.prototype, {
  getLocalString: function(abbr) {
    if (this.data.hasOwnProperty(abbr))
      return this.data[abbr][this.locale];
    return abbr;
  }
});

function getCountryNames() {
  var names = {};
  fs.readFileSync(kRootPath + '/res/countrynames')
      .toString()
      .split('\n')
      .forEach(function(line) {
        var match = /([A-Z]+)\s+(.+)/.exec(line);
        if (match)
          names[match[1]] = match[2].split('|');
      });
  return new I18nStrings(names, ['en-us', 'zh-cn']);
}

function initiateTree(TreeNodeType) {

  var countryColls = [{}, {}];
  var prefixColl = [];

  function parseSpecs(specs, color, followFile) {
    specs.trim().split(/[\s,]+/).forEach(function(spec) {
      if (!spec)
        return;
      if (/^[a-zA-Z]{2}$/.test(spec)) {
        countryColls[color][spec.toUpperCase()] = true;
      } else if (/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(spec)) {
        var block = spec.split('/');
        var length = block.length > 1 ? parseInt(block[1], 10) : 32;
        var prefix = new Prefix(block[0], length);
        prefix.color = color;
        prefixColl.push(prefix);
      } else if (followFile) {
        fs.readFileSync(spec)
            .toString()
            .split(/(?:#.*)?[\n\r]+/)
            .forEach(function(spec) {
              parseSpecs(spec, color);
            });
      }
    });
  }

  parseSpecs(opts.net || 'CN', kRed, true);
  parseSpecs(opts.vpn || 'US,GB,JP,HK', kBlue, true);

  var root = new TreeNodeType();
  getAllRegionalDelegation().forEach(function(prefix) {
    if (countryColls[kRed].hasOwnProperty(prefix.country))
      prefix.color = kRed;
    else if (countryColls[kBlue].hasOwnProperty(prefix.country))
      prefix.color = kBlue;
    root.append(prefix);
  });
  // if (flags.nonap === undefined || flags.nonap === true)
  //   getNonAPNICDelegation().forEach(function(prefix) {
  //     prefix.color = kBlue;
  //     root.append(prefix);
  //   });
  prefixColl.forEach(function(prefix) {
    root.append(prefix);
  });

  return root;

}

$define(exports, {
  options: opts,
  flags: flags,
  Prefix: Prefix,
  RouteTable: RouteTable,
  TreeNode: TreeNode,
  toIPv4: toIPv4,
  parseIPv4: parseIPv4,
  getMaskLength: getMaskLength,
  getRulesFromInput: getRulesFromInput,
  getRegionalDelegation: getRegionalDelegation,
  getAllRegionalDelegation: getAllRegionalDelegation,
  getNonAPNICDelegation: getNonAPNICDelegation,
  getCountryNames: getCountryNames,
  initiateTree: initiateTree
});
