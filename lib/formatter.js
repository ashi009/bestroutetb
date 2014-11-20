function format(fmt) {
  var args = Array.slice(arguments, 1);
  return fmt.replace(/%(([a-zA-Z]\w*)|(\d+)|\{([a-zA-Z]\w*)\}|\{(\d+)\})\b/g, function(all, key, name, index, name2, index2) {
    name = name || name2;
    index = index || index2;
    if (index !== undefined)
      return args[parseInt(index, 10)];
    for (var i = 0; i < args.length; i++)
      if (args[i].hasOwnProperty(name))
        return args[i][name];
    return '';
  });
}

function Formatter(options) {
  $extend(this, options, true);
}
$declare(Formatter, {

  gateway: {
    net: '$netgw',
    vpn: '$vpngw'
  },

  groupName: {
    net: 'net',
    vpn: 'vpn'
  },

  filterRule: function(rule) {
    if (!this.defaultGateway && rule.prefix === '0.0.0.0' && rule.length === 0)
      return false;
    return true;
  },

  groupRules: function(rules) {
    var groups = {};
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (!groups[rule.gateway])
        groups[rule.gateway] = [];
      groups[rule.gateway].push(rule);
    }
    return groups;
  },

  formatRule: function(rule) {
    return format(this.ruleFormat, {
      prefix: rule.prefix,
      mask: rule.mask,
      length: rule.length,
      gw: this.gateway[rule.gateway] || rule.gateway
    });
  },

  format: function(rules) {
    var output = [];

    rules = rules.filter(this.filterRule.bind(this));

    if (this.header)
      output.push(this.header);

    if (this.groupGateway) {
      var groups = this.groupRules(rules);
      for (var gateway in groups) {
        if (this.groupHeader)
          output.push(format(this.groupHeader, {
            name: this.groupName[gateway] || gateway
          }));
        rules = groups[gateway];
        for (var i = 0; i < rules.length; i++)
          output.push(this.formatRule(rules[i]));
        if (this.groupFooter)
          output.push(format(this.groupFooter, {
            name: this.groupName[gateway] || gateway
          }));
      }
    } else {
      for (var i = 0; i < rules.length; i++)
        output.push(this.formatRule(rules[i]));
    }

    if (this.footer)
      output.push(this.footer);

    return output.join('');
  }
});

module.exports = Formatter;

