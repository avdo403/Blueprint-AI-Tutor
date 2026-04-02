import fs from 'fs';
import http from 'http';

http.get('http://localhost:3000/src/components/UEBlueprintViewer.tsx', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const lines = data.split('\n');
    for (let i = 15; i < 35; i++) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  });
});
