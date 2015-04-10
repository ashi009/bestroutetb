module.exports = function(Formatter) {

function MacUpFormatter() {
}
$inherit(MacUpFormatter, Formatter, {
  format: function(rules) {
    var up = [];
    up.push('#!/bin/sh');
    up.push('export PATH="/bin:/sbin:/usr/sbin:/usr/bin"');
    up.push('OLDGW=`netstat -nr | grep "^default" | grep -v "ppp" | sed "s/default *\\([0-9\\.]*\\) .*/\\1/"`');
    up.push('dscacheutil -flushcache');
    // up.push('if [ ! -e /tmp/pptp_oldgw ]; then');
    up.push('echo $OLDGW > /tmp/pptp_oldgw');
    up.push('route add 10.0.0.0/8 $OLDGW');
    up.push('route add 172.16.0.0/12 $OLDGW');
    up.push('route add 192.168.0.0/16 $OLDGW');
    // up.push('fi');
    rules.forEach(function(rule) {
      if (rule.gateway === 'vpn') {
        up.push('route add ' + rule.prefix + '/' + rule.length + ' -interface $0');
      } else {
        up.push('route add ' + rule.prefix + '/' + rule.length + ' $OLDGW');
      }
    });
    return up.join('\n');
  }
});
function MacDownFormatter() {
}
$inherit(MacDownFormatter, Formatter, {
  format: function(rules) {
    var up = [];
    up.push('#!/bin/sh');
    up.push('if [ ! -e /tmp/pptp_oldgw ]; then');
    up.push('    exit 0');
    up.push('fi');
    up.push('OLDGW=`cat /tmp/pptp_oldgw`');
    up.push('route delete 10.0.0.0/8 $OLDGW');
    up.push('route delete 172.16.0.0/12 $OLDGW');
    up.push('route delete 192.168.0.0/16 $OLDGW');
    rules.forEach(function(rule) {
      if (rule.gateway === 'vpn') {
        up.push('route delete ' + rule.prefix + '/' + rule.length + ' -interface $0');
      } else {
        up.push('route delete ' + rule.prefix + '/' + rule.length + ' $OLDGW');
      }
    });
    up.push('rm /tmp/pptp_oldgw');
    return up.join('\n');
  }
});
return {
  'ip-up': {
    mode: 0777,
    Formatter: MacUpFormatter
  },
  'ip-down': {
    mode: 0777,
    Formatter: MacDownFormatter
  }
};

};
