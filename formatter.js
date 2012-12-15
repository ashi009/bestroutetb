var fs = require('fs');
var lib = require('./lib.js');
var opts = lib.options;

var kDefaultGateway = {
  net: opts.netgw,
  vpn: opts.vpngw
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
    header: '#!/bin/sh',
    format: 'route add %prefix netmask %mask gw %gw',
    gw: kDefaultGateway
  },
  route_down: {
    header: '#!/bin/sh',
    format: 'route delete %prefix',
    gw: kDefaultGateway
  },
  iproute_up: {
    header: '#!/bin/sh',
    format: 'ip r a %prefix/%length via %gw',
    gw: kDefaultGateway
  },
  iproute_down: {
    header: '#!/bin/sh',
    format: 'ip r d %prefix',
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
    groupHeader: '%gw() {',
    groupFooter: '}',
    format: 'ip r a %prefix/%length via %gw',
    groupgw: true,
    gw: kDefaultGateway
  },
  custom: {
    format: opts.format,
    groupgw: !!opts.groupgw,
    gw: kDefaultGateway
  }
};
var kProfile = kProfiles.hasOwnProperty(opts.profile) ?
    kProfiles[opts.profile] : kProfiles.openvpn;

lib.getRulesFromInput(function(rules) {

  var prevGateway = null;

  var header = opts.header || kProfile.header;
  var footer = opts.footer || kProfile.footer;
  var groupHeader = opts.groupHeader || kProfile.groupHeader;
  var groupFooter = opts.groupFooter || kProfile.groupFooter;

  if (kProfile.groupgw) {
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

  rules.forEach(function(rule) {
    if (kProfile.groupgw && prevGateway != rule.gw) {
      if (prevGateway && groupFooter)
        console.log(groupFooter.format(rule, opts));
      prevGateway = rule.gw;
      if (prevGateway && groupHeader)
        console.log(groupHeader.format(rule, opts));
    }
    if (rule.gw) {
      rule.gw = kProfile.gw[rule.gw];
      console.log(kProfile.format.format(rule, opts));
    }
  });

  if (footer)
    console.log(footer);

});
