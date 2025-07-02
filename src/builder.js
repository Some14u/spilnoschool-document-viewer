const fs = require('fs');
const path = require('path');

function buildWidget() {
  console.log('🔨 Starting widget build...');
  
  global.data = {
    host: 'localhost:3000' // Default host, can be overridden
  };
  
  const componentsDir = path.join(__dirname, 'components');
  const distDir = path.join(__dirname, '..', 'dist');
  
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  try {
    console.log('📝 Processing CSS component...');
    require(path.join(componentsDir, 'css.js'));
    
    console.log('⚡ Processing JavaScript component...');
    require(path.join(componentsDir, 'javascript.js'));
    
    console.log('🏗️  Processing HTML component...');
    require(path.join(componentsDir, 'html.js'));
    
    const outputPath = path.join(distDir, 'widget.html');
    fs.writeFileSync(outputPath, global.data.html, 'utf8');
    
    console.log('✅ Widget built successfully!');
    console.log(`📄 Output: ${outputPath}`);
    console.log(`📊 Size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
    
    return true;
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    return false;
  }
}

if (require.main === module) {
  buildWidget();
}

module.exports = { buildWidget };
