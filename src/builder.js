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
    
    const widgetOutputPath = path.join(distDir, 'widget.html');
    fs.writeFileSync(widgetOutputPath, global.data.html, 'utf8');
    
    const testPagePath = path.join(__dirname, '..', 'test', 'index.html');
    const indexOutputPath = path.join(distDir, 'index.html');
    
    if (fs.existsSync(testPagePath)) {
      let testPageContent = fs.readFileSync(testPagePath, 'utf8');
      console.log(`📋 Test page size: ${testPageContent.length} characters`);
      testPageContent = testPageContent.replace('src="../dist/widget.html"', 'src="./widget.html"');
      fs.writeFileSync(indexOutputPath, testPageContent, 'utf8');
      console.log('📋 Test page copied to dist/index.html');
    } else {
      console.log('❌ Test page not found at:', testPagePath);
    }
    
    console.log('✅ Widget built successfully!');
    console.log(`📄 Widget: ${widgetOutputPath}`);
    console.log(`📋 Test page: ${indexOutputPath}`);
    console.log(`📊 Widget size: ${(fs.statSync(widgetOutputPath).size / 1024).toFixed(2)} KB`);
    
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
