#!/bin/bash

/usr/bin/http --timeout 15 --body --pretty none --check-status GET :3001/self-test
[ $? == 0 ]
