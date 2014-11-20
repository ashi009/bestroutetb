var Prefix = require('./prefix');

function RouteTable() {
  this.table = [];
  for (var i = 0; i <= 32; i++)
    this.table.push({});
}
$declare(RouteTable, {
  /**
   * add a route direction to route table
   * @param {string} prefix  prefix to add
   * @param {int} length     length of the prefix
   * @param {string} gateway gateway for the route
   */
  add: function(prefix, length, gateway) {
    console.assert(length >= 0 && length <= 32);
    this.table[length][Prefix.parseIPv4(prefix)] = gateway;
  },
  /**
   * route an IP address
   * @param  {string} ip host IP address to route
   * @return {string}    gateway
   */
  route: function(ip) {
    ip = Prefix.parseIPv4(ip);
    for (var i = 32; i > 0; i--) {
      var maskedIp = ip & (0xffffffff << (32 - i));
      if (this.table[i][maskedIp])
        return this.table[i][maskedIp];
    }
    if (this.table[0][0])
      return this.table[0][0];
    return null;
  }
});

module.exports = RouteTable;
