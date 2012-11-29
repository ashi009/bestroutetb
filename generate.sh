#!/bin/sh

[ -e delegated-apnic-latest.dat ] || \
  wget -O delegated-apnic-latest.dat http://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest

[ -e ipv4-address-space.dat ] || \
  wget -O ipv4-address-space.dat http://www.iana.org/assignments/ipv4-address-space/ipv4-address-space.txt

routes=$1
shift

[ $routes ] && {
  node minifier.js "$@" > $routes
  node evaluator.js $routes
}
