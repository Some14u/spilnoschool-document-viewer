const fs = require('fs');
const path = require('path');

function generateErrorPage(componentName, error, distDir) {
  const errorHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Build Error - ${componentName}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
      .error-container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
      .error-title { color: #d32f2f; font-size: 24px; margin-bottom: 20px; }
      .error-component { color: #666; font-size: 18px; margin-bottom: 15px; }
      .error-message { background: #ffebee; padding: 15px; border-left: 4px solid #d32f2f; margin: 20px 0; }
      .error-stack { background: #f5f5f5; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; white-space: pre-wrap; overflow-x: auto; }
      .retry-info { margin-top: 30px; padding: 15px; background: #e3f2fd; border-radius: 4px; }
    </style>
  </head>
  <body>
    <div class="error-container">
      <h1 class="error-title">🔨 Build Error</h1>
      <div class="error-component">Component: <strong>${componentName}</strong></div>
      <div class="error-message">
        <strong>Error:</strong> ${error.message}
      </div>
      <div class="error-stack">${error.stack}</div>
      <div class="retry-info">
        <strong>💡 Tip:</strong> Fix the error in the ${componentName} component and the build will automatically retry.
      </div>
    </div>
  </body>
</html>`;
  
  const widgetOutputPath = path.join(distDir, 'widget.html');
  fs.writeFileSync(widgetOutputPath, errorHtml, 'utf8');
  console.error(`❌ ${componentName} build failed, error page generated`);
}

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

  let buildSuccess = true;
  
  try {
    console.log('📝 Processing CSS component...');
    delete require.cache[path.join(componentsDir, 'css.js')];
    require(path.join(componentsDir, 'css.js'));
  } catch (error) {
    generateErrorPage('CSS', error, distDir);
    buildSuccess = false;
  }

  if (buildSuccess) {
    try {
      console.log('⚡ Processing JavaScript component...');
      delete require.cache[path.join(componentsDir, 'javascript.js')];
      require(path.join(componentsDir, 'javascript.js'));
    } catch (error) {
      generateErrorPage('JavaScript', error, distDir);
      buildSuccess = false;
    }
  }

  if (buildSuccess) {
    try {
      console.log('🏗️  Processing HTML component...');
      delete require.cache[path.join(componentsDir, 'html.js')];
      require(path.join(componentsDir, 'html.js'));
    } catch (error) {
      generateErrorPage('HTML', error, distDir);
      buildSuccess = false;
    }
  }

  if (!buildSuccess) {
    return false;
  }

  try {
    const widgetOutputPath = path.join(distDir, 'widget.html');
    fs.writeFileSync(widgetOutputPath, global.data.html, 'utf8');

    const testPagePath = path.join(__dirname, '..', 'test', 'index.html');
    const indexOutputPath = path.join(distDir, 'index.html');

    if (fs.existsSync(testPagePath)) {
      let testPageContent = '';
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          testPageContent = fs.readFileSync(testPagePath, 'utf8');
          if (testPageContent.length > 0) {
            break;
          }
          if (attempts < maxAttempts - 1) {
            const start = Date.now();
            while (Date.now() - start < 100) {
            }
          }
        } catch (error) {
          console.log(`⚠️ Attempt ${attempts + 1} failed to read test page:`, error.message);
        }
        attempts++;
      }

      console.log(`📋 Test page size: ${testPageContent.length} characters`);
      if (testPageContent.length > 0) {
        testPageContent = testPageContent.replace('src="../dist/widget.html"', 'src="./widget.html"');
        fs.writeFileSync(indexOutputPath, testPageContent, 'utf8');
        console.log('📋 Test page copied to dist/index.html');
      } else {
        console.log('❌ Test page content is empty after all attempts');
      }
    } else {
      console.log('❌ Test page not found at:', testPagePath);
    }

    console.log('✅ Widget built successfully!');
    console.log(`📄 Widget: ${widgetOutputPath}`);
    console.log(`📋 Test page: ${indexOutputPath}`);
    console.log(`📊 Widget size: ${(fs.statSync(widgetOutputPath).size / 1024).toFixed(2)} KB`);

    return true;
  } catch (error) {
    generateErrorPage('File System', error, distDir);
    console.error('❌ Build failed:', error.message);
    return false;
  }
}

if (require.main === module) {
  buildWidget();
}

module.exports = { buildWidget };
