require('apollojs');

var assert = require('assert');

/**
 * convert numeric IP address to human readable format
 * @param  {int} v  IP address
 * @return {string} human readable IP address
 */
function toIPv4(v) {
  var parts = [];
  for (var i = 24; i >= 0; i -= 8)
    parts.push((v >>> i) & 0xff);
  return parts.join('.');
}

/**
 * parse a given IPv4 address
 * @param  {string} ip IPv4 address (eg. "8.0.0.0")
 * @return {int}       numeric representation of the address
 */
function parseIPv4(ip) {
  return ip.split('.').reduce(function(lhv, rhv) {
    return (lhv << 8) | parseInt(rhv, 10);
  }, 0);
}

/**
 * get mask length
 * @param  {int} mask mask in int
 * @return {int}      length of mask
 */
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
    this._length = prefix.length;
  } else {
    this.prefix = typeof prefix === 'string' ?
        parseIPv4(prefix) : prefix;
    this.length = typeof mask === 'string' ?
        getMaskLength(parseIPv4(mask)) : mask;
  }
}
$declare(Prefix, {
  /**
   * Output prefix in binary string
   * @return {string} prefix
   */
  toString: function() {
    if (this.length < 31) {
      var padded = (this.prefix >>> (32 - this.length)) | (1 << this.length);
      return padded.toString(2).substr(1);
    }
    var paddedHi = (this.prefix >>> 16) | (1 << 16);
    var paddedLo = ((this.prefix & 0xffff) >> (32 - this.length)) |
        (1 << (this.length - 16));
    return paddedHi.toString(2).substr(1) + paddedLo.toString(2).substr(1);
  },
  /**
   * get corresponding IPv4 address (eg. 8.0.0.0)
   * @return {string} ip
   */
  toIPv4: function() {
    return toIPv4(this.prefix);
  },
  /**
   * get corresponding IPv4 mask (eg. 255.225.225.0)
   * @return {string} mask
   */
  toMask: function() {
    return toIPv4(this.mask);
  },
  /**
   * get JSON format address (8.0.0.0/8)
   * @return {string} ip/len
   */
  toJSON: function() {
    if (this.length < 32)
      return this.toIPv4() + '/' + this.length;
    return this.toIPv4();
  },
  /**
   * append a bit to the end of the prefix
   * @param  {bit} bit 0/1
   * @return {Prefix}  current instance
   */
  append: function(bit) {
    assert(this.length < 32);
    this.length++;
    this.prefix |= bit << (32 - this.length);
    return this;
  },
  /**
   * remove a bit from the end of the prefix
   * @return {Prefix} current instance
   */
  pop: function() {
    assert(this.length > 0);
    this.prefix &= ~(1 << (32 - this.length));
    this.length--;
    return this;
  },
  /**
   * get bit on specific index
   * @param  {int} index (from most significant pos)
   * @return {bit}
   */
  get: function(index) {
    if (this.prefix & (0x80000000 >>> index))
      return 1;
    return 0;
  },
  /**
   * get a deep copy of current instance
   * @return {Prefix} copied instance
   */
  clone: function() {
    return new Prefix(this.prefix, this.length);
  },
  /**
   * check if current prefix is prefix of another one
   * @param  {Prefix}  p Prefix to test with
   * @return {bool}
   */
  isPrefixOf: function(p) {
    return this.length === 0 || this.length <= p.length &&
        (this.prefix ^ p.prefix) >> (32 - this.length) === 0;
  },
  /**
   * get mask in int
   * @return {int} mask
   */
  get mask() {
    if (this.length === 0)
      return 0;
    return 0x80000000 >> (this.length - 1);
  },
  /**
   * get size of covered address by this prefix
   * @return {int} size
   */
  get size() {
    return 1 << (32 - this.length);
  },
  /**
   * get length of this prefix
   */
  get length() {
    return this._length;
  },
  /**
   * set length
   */
  set length(length) {
    this._length = length;
    this.prefix &= this.mask;
  }
});
$define(Prefix, {
  toIPv4: toIPv4,
  parseIPv4: parseIPv4,
  getMaskLength: getMaskLength,
  /**
   * parse JSON stringified prefix
   * @param  {string} prefix stringified prefix
   * @return {Prefix}        prefix instance
   */
  parse: function(prefix) {
    var parts = prefix.split('/');
    return new Prefix(parts[0], parts.length < 2 ? 32 : +parts[1]);
  },
  /**
   * Prefix comparator to sort prefix in lexicographic order
   * @param  {Prefix} lhp left hand prefix
   * @param  {Prefix} rhp right hand prefix
   * @return {int}        -1, 0, or 1
   */
  comparator: function(lhp, rhp) {
    // return (rhp.prefix >>> 31) - (lhp.prefix >>> 31);
    if (lhp.prefix >= 0 && rhp.prefix < 0)
      return -1;
    if (rhp.prefix >= 0 && lhp.prefix < 0)
      return 1;
    if (lhp.isPrefixOf(rhp))
      return -1;
    if (rhp.isPrefixOf(lhp))
      return 1;
    return lhp.prefix - rhp.prefix ||
        lhp.length - rhp.length;
  }
});

module.exports = Prefix;
