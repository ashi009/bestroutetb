module.exports = function(Formatter) {

function OpenvpnFormatter() {
  Formatter.apply(this, arguments);
}
$inherit(OpenvpnFormatter, Formatter, {
  ruleFormat: 'route %prefix %mask %gw\n',
  gateway: {
    net: 'net_gateway',
    vpn: 'vpn_gateway'
  }
});

return {
  '%': {
    Formatter: OpenvpnFormatter
  }
};

};
