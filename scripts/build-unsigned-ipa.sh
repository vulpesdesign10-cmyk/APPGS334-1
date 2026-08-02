#!/usr/bin/env bash
set -euo pipefail
rm -rf build Payload GS334-iOS-unsigned.ipa
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -sdk iphoneos \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" build
APP_PATH="build/Build/Products/Release-iphoneos/App.app"
test -d "$APP_PATH"
mkdir Payload
cp -R "$APP_PATH" Payload/
zip -qry GS334-iOS-unsigned.ipa Payload
printf '\nCreated: %s/GS334-iOS-unsigned.ipa\n' "$PWD"
