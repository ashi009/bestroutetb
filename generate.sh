#!/bin/sh

workingpath=$(pwd)
root=$(dirname $0)

routes=$1
shift

cd $root

[ -e data/delegated-apnic-latest ] || \
  wget -O data/delegated-apnic-latest http://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest

[ -e data/ipv4-address-space ] || \
  wget -O data/ipv4-address-space http://www.iana.org/assignments/ipv4-address-space/ipv4-address-space.txt

[ $routes ] && {
  node minifier.js "$@" | tee rules.json | node formatter.js "$@" > $workingpath/$routes
  node evaluator.js rules.json
  rm -f rules.json
}
