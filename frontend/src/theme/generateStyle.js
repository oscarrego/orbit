const fs = require('fs');
const https = require('https');

https.get('https://basemaps.cartocdn.com/gl/positron-gl-style/style.json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const style = JSON.parse(data);
    
    // Recommended palette:
    // background: #ececea
    // water: #dde7f2
    // primary roads: #9aa6b5
    // secondary roads: #c7cdd4
    // labels: #4f5968

    style.layers.forEach(layer => {
      const id = layer.id;
      
      if (id === 'background' || id.includes('land')) {
        if (layer.paint && layer.paint['background-color']) {
          layer.paint['background-color'] = '#ececea';
        }
        if (layer.paint && layer.paint['fill-color']) {
          layer.paint['fill-color'] = '#ececea';
        }
      }
      
      if (id.includes('water') && layer.type === 'fill') {
        if (layer.paint) layer.paint['fill-color'] = '#dde7f2';
      }

      if (id.includes('road') || id.includes('highway') || id.includes('bridge') || id.includes('tunnel')) {
        if (layer.type === 'line' && layer.paint) {
          const isPrimary = id.includes('primary') || id.includes('motorway') || id.includes('trunk');
          layer.paint['line-color'] = isPrimary ? '#9aa6b5' : '#c7cdd4';
          layer.paint['line-opacity'] = 0.9;
          
          if (isPrimary) {
             layer.paint['line-width'] = [
              "interpolate",
              ["exponential", 1.2],
              ["zoom"],
              10, 1.5,
              14, 4,
              18, 10
            ];
          }
        }
      }

      if (id.includes('label') || id.includes('place')) {
        if (layer.type === 'symbol' && layer.paint) {
          layer.paint['text-color'] = '#4f5968';
          layer.paint['text-halo-color'] = '#ececea';
          layer.paint['text-halo-width'] = 2;
        }
      }
    });

    const fileContent = `export const customLightMapStyle = ${JSON.stringify(style, null, 2)};\n`;
    fs.writeFileSync('frontend/src/theme/customLightMapStyle.js', fileContent);
    console.log('Custom style generated successfully!');
  });
}).on('error', (err) => {
  console.log('Error: ' + err.message);
});
