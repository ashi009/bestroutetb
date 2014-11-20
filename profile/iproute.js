module.exports = function(Formatter) {

function IpRouteUpFormatter() {
  Formatter.apply(this, arguments);
}
$inherit(IpRouteUpFormatter, Formatter, {
  header: '#!/bin/sh\nip -b - <<FILE\n',
  footer: 'FILE\n',
  ruleFormat: 'r a %prefix/%length via %gw\n'
});

function IpRouteDownFormatter() {
  Formatter.apply(this, arguments);
}
$inherit(IpRouteDownFormatter, IpRouteUpFormatter, {
  ruleFormat: 'r d %prefix/%length via %gw\n'
});

return {
  'up.sh': {
    mode: 0777,
    Formatter: IpRouteUpFormatter
  },
  'down.sh': {
    mode: 0777,
    Formatter: IpRouteDownFormatter
  }
};

};
