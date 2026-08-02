import fs from 'node:fs';
const plist='ios/App/App/Info.plist';
if(!fs.existsSync(plist)) throw new Error('Chưa có iOS project. Hãy chạy npx cap add ios trước.');
let s=fs.readFileSync(plist,'utf8');
const insert=`\n\t<key>NSLocalNetworkUsageDescription</key>\n\t<string>GS334 cần truy cập mạng nội bộ để in trực tiếp tới máy in LAN.</string>\n\t<key>NSAppTransportSecurity</key>\n\t<dict>\n\t\t<key>NSAllowsLocalNetworking</key>\n\t\t<true/>\n\t</dict>\n`;
if(!s.includes('NSLocalNetworkUsageDescription')) s=s.replace('</dict>\n</plist>',insert+'</dict>\n</plist>');
fs.writeFileSync(plist,s);
