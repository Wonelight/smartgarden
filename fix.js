const fs = require('fs');
const path = 'frontend/smart-garden-frontend/src/pages/GardenConfigPage.tsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(/lg:\s+p-/g, 'lg:p-');
c = c.replace(/hover:\s+-translate/g, 'hover:-translate');
c = c.replace(/hover:\s+shadow/g, 'hover:shadow');
c = c.replace(/shadow-\[\s*0_8px_30px_rgb\(\s*0,\s*0,\s*0,\s*0\.04\)\s*\]/g, 'shadow-[0_8px_30px_rgb(0,0,0,0.04)]');
c = c.replace(/shadow-\[\s*0_8px_30px_rgb\(\s*0,\s*0,\s*0,\s*0\.08\)\s*\]/g, 'shadow-[0_8px_30px_rgb(0,0,0,0.08)]');
c = c.replace(/shadow-\[\s*0_4px_20px_rgb\(\s*20,\s*184,\s*166,\s*0\.15\)\s*\]/g, 'shadow-[0_4px_20px_rgb(20,184,166,0.15)]');

// General fixer for "word: word", but avoid destroying code logic like React things or objects.
// Let's only target classNames!
c = c.replace(/className=\{`([^`]+)`\}/g, (match, classNames) => {
    let fixed = classNames.replace(/(\w+):\s+([-a-zA-Z0-9_\[\]\(\)\.]+)/g, '$1:$2');
    return `className={\`${fixed}\`}`;
});
c = c.replace(/className="([^"]+)"/g, (match, classNames) => {
    let fixed = classNames.replace(/(\w+):\s+([-a-zA-Z0-9_\[\]\(\)\.]+)/g, '$1:$2');
    return `className="${fixed}"`;
});
// Re-read issue with spaces in rgb
c = c.replace(/rgb\(0,\s*0,\s*0,\s*0\.04\)/g, 'rgb(0,0,0,0.04)');
c = c.replace(/rgb\(0,\s*0,\s*0,\s*0\.08\)/g, 'rgb(0,0,0,0.08)');
c = c.replace(/rgb\(20,\s*184,\s*166,\s*0\.15\)/g, 'rgb(20,184,166,0.15)');

// specific known problem strings from the lint 
c = c.replace(/phút \$ /g, 'phút ${');
c = c.replace(/giây \$ /g, 'giây ${');
c = c.replace(/ngày \$ /g, 'ngày ${');

fs.writeFileSync(path, c);
console.log("Done");
