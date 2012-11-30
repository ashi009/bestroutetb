#!/bin/sh

root=$(dirname $0)/

[ -e ${root}delegated-apnic-latest.dat ] || \
  wget -O ${root}delegated-apnic-latest.dat http://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest

[ -e ${root}ipv4-address-space.dat ] || \
  wget -O ${root}ipv4-address-space.dat http://www.iana.org/assignments/ipv4-address-space/ipv4-address-space.txt

routes=$1
shift

[ $routes ] && {
  node ${root}minifier.js "$@" > $routes
  node ${root}evaluator.js $routes
}
