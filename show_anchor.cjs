const fs = require('fs');
const p = 'src/pages/HR/HRDashboard.tsx';
const lines = fs.readFileSync(p, 'utf8').split('\n');
for (let n = 44; n <= 80; n++) {
  console.log((n) + '|' + JSON.stringify(lines[n-1]));
}

