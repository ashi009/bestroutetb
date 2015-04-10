module.exports = function(Formatter) {

function MacUpFormatter() {
}
$inherit(MacUpFormatter, Formatter, {
  format: function(rules) {
    var up = [];
    up.push('#!/bin/sh');
    up.push('export PATH="/bin:/sbin:/usr/sbin:/usr/bin"');
    up.push('OLDIF=`netstat -nr | grep "^default" | grep -v "ppp" | grep -oE "[^ ]+$"`');
    up.push('dscacheutil -flushcache');
    // up.push('if [ ! -e /tmp/pptp_oldif ]; then');
    up.push('echo $OLDIF > /tmp/pptp_oldif');
    // up.push('fi');
    rules.forEach(function(rule) {
      if (rule.gateway === 'vpn') {
        up.push('route add ' + rule.prefix + '/' + rule.length + ' -interface $0');
      } else {
        up.push('route add ' + rule.prefix + '/' + rule.length + ' -interface $OLDIF');
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
    up.push('if [ ! -e /tmp/pptp_oldif ]; then');
    up.push('    exit 0');
    up.push('fi');
    up.push('ODLGW=`cat /tmp/pptp_oldif`');
    rules.forEach(function(rule) {
      if (rule.gateway === 'vpn') {
        up.push('route delete ' + rule.prefix + '/' + rule.length + ' -interface $0');
      } else {
        up.push('route delete ' + rule.prefix + '/' + rule.length + ' -interface $OLDIF');
      }
    });
    up.push('rm /tmp/pptp_oldif');
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
