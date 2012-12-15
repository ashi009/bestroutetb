var fs = require('fs');
var lib = require('./lib.js');
var opts = lib.options;

var kDefaultGateway = {
  netgw: opts.netgw,
  vpngw: opts.vpngw
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
  custom: {
    format: opts.format,
    gw: kDefaultGateway
  }
};
var kProfile = kProfiles.hasOwnProperty(opts.profile) ?
    kProfiles[opts.profile] : kProfiles.openvpn;

lib.getRulesFromInput(function(rules) {
  var header = opts.header || kProfile.header;
  if (header)
    console.log(header);
  rules.forEach(function(rule) {
    rule.gw = kProfile.gw[rule.gw];
    console.log(kProfile.format.format(rule, opts));
  });
  var footer = opts.footer || kProfile.footer;
  if (footer)
    console.log(footer);
});
