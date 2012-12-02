Array.prototype.forEach = function(fn, self) {
  for (var i = 0; i < this.length; i++)
    fn.call(self, this[i], i, this);
};

var console = {
  log: function(s, args) {
    if (typeof s === 'string' && args !== undefined) {
      args = [].slice.call(arguments, 1);
      var i = 0;
      var s = s.replace(/%[sd]/g, function() {
        return args[i++];
      });
      while (i < args.length)
        s += ', ' + args[i++];
      WSH.echo(s);
    } else {
      WSH.echo(s);
    }
  }
};

var process = {
  exit: function() {
    WSH.quit();
  },
  argv: (function(args, namedArgs) {
    var res = new Array(args.length);
    for (var i = 0; i < res.length; i++)
      res[i] = args.item(i);
    for (var it = new Enumerator(namedArgs); !it.atEnd(); it.moveNext())
      res[it.item().toLowerCase()] = namedArgs.item(it.item());
    return res;
  })(WScript.arguments.unnamed, WScript.arguments.named)
};

if (process.argv.length < 2) {
  console.log('Usage:\n\
    setroute.js up|down RouteFile [/netgw:IP] [/vpngw:IP]');
  process.exit();
}

var action = process.argv[0];
var routeFile = process.argv[1];
var wmi = GetObject('winmgmts:{impersonationLevel=impersonate}');
var newRoutes = getRoutes(routeFile);

if (action == 'up') {
  var defaultRoutes = getDefaultRoutes();
  var gateways = {
    net: process.argv.netgw || defaultRoutes.net.nextHop,
    vpn: process.argv.vpngw || defaultRoutes.vpn.nextHop
  };
  if (!gateways.net || !gateways.vpn) {
    console.log('FAILED to find net_gateway (%s) or vpn_gateway (%s).',
        gateways.net, gateways.vpn);
    process.exit();
  }
  var defaultRoute = defaultRoutes.net;
  for (var destination in newRoutes) {
    var route = defaultRoute.Clone_();
    var newRoute = newRoutes[destination];
    route.destination = destination;
    route.mask = newRoute[0];
    route.nextHop = gateways[newRoute[1].substr(0, 3)];
    route.metric1 = 40;
    try {
      route.put_();
    } catch(e) {
      console.log('FAILED to add %s: %s', destination, newRoute.join(', '));
      console.log(e.message);
    }
  }
} else if (action == 'down') {
  var curRoutes = wmi.InstancesOf('Win32_IP4RouteTable');
  for (var it = new Enumerator(curRoutes); !it.atEnd(); it.moveNext()) {
    var item = it.item();
    if (newRoutes.hasOwnProperty(item.Destination))
      item.delete_();
  }
}

function getDefaultRoutes() {
  var routes = wmi.InstancesOf('Win32_IP4RouteTable');
  var ageSum = 0;
  var count = 0;
  var defaults = [];
  for (var it = new Enumerator(routes); !it.atEnd(); it.moveNext()) {
    var item = it.item();
    if (item.Destination === '0.0.0.0') {
      ageSum += item.Age;
      count++;
      defaults.push(item);
    }
  }
  var ageAvg = ageSum / count;
  var defaultRoutes = {
    net: null,
    vpn: null
  };
  defaults.forEach(function(item) {
    if (item.age >= ageAvg)
      defaultRoutes.net = item;
    else
      defaultRoutes.vpn = item;
  });
  return defaultRoutes;
}

function getRoutes(path) {
  var fso = new ActiveXObject("Scripting.FileSystemObject");
  var file = fso.openTextFile(path, 1);
  var content = file.readAll();
  file.close();
  var res = {};
  content.split(/[\r\n]+/g).forEach(function(line) {
    if (!/^route/.test(line))
      return;
    var args = line.split(' ');
    res[args[1]] = [args[2], args[4]];
  });
  return res;
}
