require('apollojs');

var fs = require('fs');
var urlUtil = require('url');
var pathUtil = require('path');
var async = require('async');
var ftp = require('ftp');

var Prefix = require('./prefix');

var kDelegationDbPath = pathUtil.resolve(__dirname, '../db/delegation.json');
var kDelegationDbLifeTime = 24*60*60*1000;  // 1d

var kRegionalDelegationFiles = [{
  name: 'apnic',
  url: 'ftp://ftp.apnic.net/pub/stats/apnic/delegated-apnic-latest'
}, {
  name: 'arin',
  url: 'ftp://ftp.arin.net/pub/stats/arin/delegated-arin-extended-latest'
}, {
  name: 'ripencc',
  url: 'ftp://ftp.ripe.net/pub/stats/ripencc/delegated-ripencc-latest'
}, {
  name: 'lacnic',
  url: 'ftp://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-latest'
}];

function downloadFile(url, callback) {
  url = urlUtil.parse(url);
  var client = new ftp();
  async.waterfall([
    function(callback) {
      client.on('ready', callback);
    },
    function(callback) {
      client.size(url.pathname, callback);
    },
    function(size, callback) {
      client.get(url.pathname, function(err, stream) {
        if (err)
          return callback(err);
        stream.once('close', function() {
          client.end();
        });
        stream.length = size;
        callback(null, stream);
      });
    }
  ], function(err, stream) {
    if (err)
      client.end();
    callback(err, stream);
  });
  client.on('error', callback);
  client.connect({
    host: url.host
  });
  // DEBUG
  // var path = pathUtil.join(
  //     pathUtil.resolve(__dirname, '../db'),
  //     pathUtil.basename(url.pathname).replace(/^[a-z]+-|-[a-z-]+$/g, ''));
  // var stream = fs.createReadStream(path);
  // stream.length = fs.statSync(path).size;
  // callback(null, stream);
}

var kDelegationEntryPattern = /^[a-z]+\|([A-Z]{2})\|ipv4\|([\d.]+)\|(\d+)/mg;

function processRegionalDelegationFile(bufs, callback) {
  var content = Buffer.concat(bufs).toString();
  bufs.length = 0;
  var delegationsByCountry = {};
  for (var match; match = kDelegationEntryPattern.exec(content); ) {
    if (!delegationsByCountry[match[1]])
      delegationsByCountry[match[1]] = [];
    var maskLength = Prefix.getMaskLength(~(parseInt(match[3], 10) - 1));
    delegationsByCountry[match[1]].push(new Prefix(match[2], maskLength));
  }
  callback(null, delegationsByCountry);
}

var pDelegationDb;
var pDbUpdatingQueue = [];

function generateDb(options, callback) {

  if (pDbUpdatingQueue.push(callback) > 1)
    return;

  var progressBar = options.progressBar;
  if (progressBar) {
    // Preventing ProgressBar terminates before finish downloading all files,
    // in case that one db file finishes downloading before all others establish
    // connections to the servers.
    progressBar.total = kRegionalDelegationFiles.length;
  }

  function handleDownloadStream(stream, callback) {
    if (progressBar) {
      progressBar.total += stream.length - 1;
      progressBar.tick(0);
    }
    var bufs = [];
    stream.on('data', function(chunk) {
      if (progressBar)
        progressBar.tick(chunk.length);
      bufs.push(chunk);
    });
    stream.on('error', function(err) {
      callback(err);
    });
    stream.on('end', function() {
      callback(null, bufs);
    });
    stream.resume();
  }

  async.map(kRegionalDelegationFiles, function(file, callback) {
    async.waterfall([
      downloadFile.bind(null, file.url),
      handleDownloadStream,
      processRegionalDelegationFile
    ], callback);
  }, function(err, regionalDbs) {
    if (!err) {
      var unsortedDb = {};
      regionalDbs.forEach(function(regionalDb) {
        for (var country in regionalDb) {
          if (!unsortedDb[country])
            unsortedDb[country] = [];
          [].push.apply(unsortedDb[country], regionalDb[country]);
        }
      });
      var sortedDb = {};
      Object.keys(unsortedDb).sort().forEach(function(country) {
        sortedDb[country] = unsortedDb[country].sort(Prefix.comparator);
      });
      pDelegationDb = DelegationDb.parse({
        byCountry: sortedDb,
        lastUpdate: Date.now()
      });
      // output as readable JSON file, making it diff friendly.
      fs.writeFileSync(kDelegationDbPath, pDelegationDb.toJSON());
    }
    while (pDbUpdatingQueue.length > 0)
      pDbUpdatingQueue.shift()(err);
  });

}

function getInstance() {
  if (!pDelegationDb)
    pDelegationDb = DelegationDb.parse(
        fs.readFileSync(kDelegationDbPath).toString());
  return pDelegationDb;
}

function DelegationDb() {
  throw new Error('This class cannot be instantiated, use getInstance instead.');
}
$declare(DelegationDb, {
  /**
   * Override default toJSON method, to output a consistent JSON format
   * @return {string} stringified db
   */
  toJSON: function() {
    return JSON.stringify($clone(this), function(key, value) {
      return key[0] != '_' ? value : undefined;
    }, 1);
  },
  /**
   * getter if db is stale
   */
  get isStale() {
    return !this.lastUpdate ||
        Date.now() - this.lastUpdate >= kDelegationDbLifeTime;
  },
  /**
   * getter version of db
   */
  get version() {
    return new Date(this.lastUpdate).toISOString().replace(/\..+$|\D/g, '');
  },
  /**
   * get prefixes of country
   * @param  {string}   country country code
   * @return {[Prefix]}         prefixes delegated to given country
   */
  getPrefixesOfCountry: function(country) {
    this._unwrap();
    country = country.toUpperCase();
    if (!this.byCountry[country])
      throw $error('cannot find country with initial %j', country);
    return this.byCountry[country].map(function(prefix) {
      return prefix.clone();
    });
  },
  /**
   * get country list
   * @return {[string]} country initials
   */
  getCountryList: function() {
    return Object.keys(this.byCountry);
  },
  /**
   * unwrap data in the db.
   */
  _unwrap: function() {
    if (this._unwrapped)
      return;
    var byCountry = this.byCountry;
    for (var country in byCountry) {
      byCountry[country] = byCountry[country].map(Prefix.parse);
    }
    this._unwrapped = true;
  }
});
$define(DelegationDb, {
  /**
   * get delegation db instance, which might be stale.
   */
  getInstance: getInstance,
  /**
   * parse a db
   * @param  {string} db    db
   * @return {DelegationDb} db instance
   */
  parse: function(db) {
    if (!Object.isObjectStrict(db))
      db = JSON.parse(db);
    else
      db._unwrapped = true;
    return $wrap(db, DelegationDb);
  },
  /**
   * update or fix db
   * @param  {object}   options  optional, options see below
   * @param  {Function} callback callback(err, db) when done
   */
  update: function(options, callback) {
    if (!Object.isObjectStrict(options)) {
      callback = options;
      options = {};
    }
    $extend(options, {
      progressBar: null,  // output progress to progress bar
      force: false,       // force update, disregard version check
      useStale: false     // force to use stale data
    });
    try {
      // try load db from file system.
      var db = getInstance();
      if (options.useStale || !options.force && !db.isStale)
        return callback(null);
    } catch(e) {
      // db is corrupted
      // console.error(e.stack);
    }
    generateDb(options, callback);
  }
});

module.exports = DelegationDb;
