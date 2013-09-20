var fs = require('fs');
var lib = require('./lib.js');
var opts = lib.options;
var flags = lib.flags;

var kDefaultGateway = {};
for(var gw in opts){
  var pattern = /^(\w+)gw$/;
  var matches = pattern.exec(gw);
  if (matches)
    kDefaultGateway[matches[1]] = opts[gw];
} 

var kGroupName = {
  net: opts.netgroupname || 'net',
  vpn: opts.vpngroupname || 'vpn'
};
var kProfiles = {
  openvpn: {
    format: 'route %prefix %mask %gw',
    gw: {
      net: 'net_gateway',
      vpn: 'vpn_gateway'
    }
  },
  route_up: {
    header: '#!/bin/sh\
netgw=$(cat /tmp/net_gateway)\
read target dummy vpngw dummy <<< $(ip route get 8.8.8.8)',
    format: 'route add %prefix netmask %mask gw %gw',
    gw: kDefaultGateway
  },
  route_down: {
    header: '#!/bin/sh',
    format: 'route delete %prefix',
    gw: kDefaultGateway
  },
  iproute_up: {
    header: '#!/bin/sh\nip -b - <<FILE',
    footer: 'FILE',
    format: 'r a %prefix/%length via %gw',
    gw: kDefaultGateway
  },
  iproute_down: {
    header: '#!/bin/sh\nip -b - <<FILE',
    footer: 'FILE',
    format: 'r d %prefix',
    gw: kDefaultGateway
  },
  win_up: {
    header: '@echo off',
    format: 'route add %prefix mask %mask %gw',
    gw: kDefaultGateway
  },
  win_down: {
    header: '@echo off',
    format: 'route delete %prefix',
    gw: kDefaultGateway
  },
  ppp_ip_up: {
    header: '#!/bin/sh',
    groupHeader: '%name() {\nip -b - <<FILE',
    groupFooter: 'FILE\n}',
    format: 'r a %prefix/%length via %gw',
    groupgw: true,
    gw: kDefaultGateway
  },
  custom: {
    format: opts.format,
    groupgw: flags.groupgw,
    gw: kDefaultGateway
  }
};

var kProfile = kProfiles.hasOwnProperty(opts.profile) ?
    kProfiles[opts.profile] : kProfiles.openvpn;

lib.getRulesFromInput(function(rules) {

  var prevGateway = null;

  var header = opts.header || kProfile.header;
  var footer = opts.footer || kProfile.footer;

  if (kProfile.groupgw) {
    var groupHeader = opts.groupheader || kProfile.groupHeader;
    var groupFooter = opts.groupfooter || kProfile.groupFooter;
    var groupGateways = kProfile.groupgw
    rules = rules.map(function(rule, index) {
      rule.index = index;
      return rule;
    }).sort(function(lhv, rhv) {
      if (lhv.gw === rhv.gw)
        return lhv.index - rhv.index;
      return lhv.gw < rhv.gw ? -1 : 1;
    }).map(function(rule, index) {
      delete rule.index;
      return rule;
    });
    rules.push({});
  }

  if (header)
    console.log(header);

  if (opts.reverse)
    rules.reverse();

  rules.forEach(function(rule) {
    if (kProfile.groupgw && prevGateway != rule.gw) {
      if (prevGateway && groupFooter)
        console.log(groupFooter.format({
          name: kGroupName[prevGateway]
        }, opts));
      if (rule.gw && groupHeader)
        console.log(groupHeader.format({
          name: kGroupName[rule.gw]
        }, opts));
      prevGateway = rule.gw;
    }
    if (rule.gw) {
      rule.gw = kProfile.gw[rule.gw] || ('$' + rule.gw + 'gw');
      if (!(flags.nodefaultgw && rule.prefix === '0.0.0.0' && rule.length === 0))
        console.log(kProfile.format.format(rule, opts));
    }
  });

  if (footer)
    console.log(footer);

});
