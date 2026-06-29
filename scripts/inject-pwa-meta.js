const fs = require('fs');
const path = require('path');

const META = [
  '<link rel="manifest" href="/manifest.json">',
  '<link rel="apple-touch-icon" href="/icon-512.png">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="SPMove">',
].join('\n    ');

let count = 0;

function processDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDir(full);
    } else if (entry.name.endsWith('.html')) {
      let html = fs.readFileSync(full, 'utf8');
      if (!html.includes('rel="manifest"')) {
        html = html.replace('</head>', `    ${META}\n  </head>`);
        fs.writeFileSync(full, html);
        count++;
      }
    }
  }
}

processDir('dist');
console.log(`[inject-pwa-meta] injected into ${count} HTML files`);
