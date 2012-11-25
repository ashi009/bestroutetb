#!/bin/sh

if [ ! -e delegated-apnic-latest.dat ]; then
  wget -o delegated-apnic-latest.dat http://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest
fi

if [ ! -e ipv4-address-space.dat ]; then
  wget -o ipv4-address-space.dat http://www.iana.org/assignments/ipv4-address-space/ipv4-address-space.txt
fi

filename=$1
shift

if [ $filename ]; then
  node minifier.js "$@" > $filename
  node evaluator.js $filename
fi
