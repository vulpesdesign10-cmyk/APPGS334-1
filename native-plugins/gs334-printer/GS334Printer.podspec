Pod::Spec.new do |s|
  s.name = 'GS334Printer'
  s.version = '1.0.0'
  s.summary = 'Native TCP ESC/POS raster printing for GS334'
  s.license = { :type => 'MIT' }
  s.homepage = 'https://appgs334.giatsay334-7d8.workers.dev'
  s.author = { 'GS334' => 'gs334@example.invalid' }
  s.source = { :git => 'https://example.invalid/gs334-printer.git', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/GS334PrinterPlugin/**/*.{swift,h,m}'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.9'
end
