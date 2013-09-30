#!/bin/sh

workingpath=$(pwd)
root=$(dirname $0)

routes=$1
shift

cd $root

[ -e data/delegated-apnic-latest ] || \
  wget -O data/delegated-apnic-latest ftp://ftp.apnic.net/pub/stats/apnic/delegated-apnic-latest

[ -e data/delegated-arin-latest ] || \
  wget -O data/delegated-arin-latest ftp://ftp.arin.net/pub/stats/arin/delegated-arin-extended-$(date --date="yesterday" +%Y%m%d)

[ -e data/delegated-ripencc-latest ] || \
  wget -O data/delegated-ripencc-latest ftp://ftp.ripe.net/pub/stats/ripencc/delegated-ripencc-latest

[ -e data/delegated-lacnic-latest ] || \
  wget -O data/delegated-lacnic-latest ftp://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-latest

# [ -e data/ipv4-address-space ] || \
#   wget -O data/ipv4-address-space http://www.iana.org/assignments/ipv4-address-space/ipv4-address-space.txt

[ $routes ] && {
  node minifier.js "$@" | tee rules.json | node formatter.js "$@" > $workingpath/$routes
  node evaluator.js rules.json
  rm -f rules.json
}
