const fs = require('fs');
const path = require('path');
const { render } = require('./utils/template');

function generateErrorPage(componentName, error, distDir) {
  try {
    const errorHtml = render('error-template.html', {
      componentName: componentName,
      errorMessage: error.message,
      errorStack: error.stack
    });

    const widgetOutputPath = path.join(distDir, 'widget.html');
    const indexOutputPath = path.join(distDir, 'index.html');

    fs.writeFileSync(widgetOutputPath, errorHtml, 'utf8');
    fs.writeFileSync(indexOutputPath, errorHtml, 'utf8');
    console.error(`❌ ${componentName} build failed, error page generated`);
  } catch (templateError) {
    const fallbackHtml = `<!DOCTYPE html>
<html><head><title>Build Error</title></head>
<body><h1>Build Error in ${componentName}</h1>
<p>Error: ${error.message}</p>
<pre>${error.stack}</pre>
<p>Template loading failed: ${templateError.message}</p></body></html>`;

    const widgetOutputPath = path.join(distDir, 'widget.html');
    const indexOutputPath = path.join(distDir, 'index.html');

    fs.writeFileSync(widgetOutputPath, fallbackHtml, 'utf8');
    fs.writeFileSync(indexOutputPath, fallbackHtml, 'utf8');
    console.error(`❌ ${componentName} build failed, fallback error page generated`);
  }
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
    testPageContent = testPageContent.replace('href="test-page.css"', 'href="./test-page.css"');
    testPageContent = testPageContent.replace('src="test-page.js"', 'src="./test-page.js"');
        fs.writeFileSync(indexOutputPath, testPageContent, 'utf8');
        console.log('📋 Test page copied to dist/index.html');
      } else {
        console.log('❌ Test page content is empty after all attempts');
      }
    } else {
      console.log('❌ Test page not found at:', testPagePath);
    }

    const testDir = path.join(__dirname, '..', 'test');
    const staticFiles = ['test-page.js', 'test-page.css'];
    
    for (const file of staticFiles) {
      const sourcePath = path.join(testDir, file);
      const destPath = path.join(distDir, file);
      
      if (fs.existsSync(sourcePath)) {
        try {
          fs.copyFileSync(sourcePath, destPath);
          console.log(`📋 Copied ${file} to dist/`);
        } catch (error) {
          console.log(`❌ Failed to copy ${file}:`, error.message);
        }
      } else {
        console.log(`❌ Static file not found: ${sourcePath}`);
      }
    }

    const publicAssetsDir = path.join(__dirname, '..', 'public', 'assets');
    const distAssetsDir = path.join(distDir, 'assets');
    
    if (fs.existsSync(publicAssetsDir)) {
      try {
        if (!fs.existsSync(distAssetsDir)) {
          fs.mkdirSync(distAssetsDir, { recursive: true });
        }
        
        const assetFiles = fs.readdirSync(publicAssetsDir);
        for (const file of assetFiles) {
          const sourcePath = path.join(publicAssetsDir, file);
          const destPath = path.join(distAssetsDir, file);
          
          if (fs.statSync(sourcePath).isFile()) {
            fs.copyFileSync(sourcePath, destPath);
            console.log(`📋 Copied asset ${file} to dist/assets/`);
          }
        }
      } catch (error) {
        console.log(`❌ Failed to copy assets:`, error.message);
      }
    } else {
      console.log('❌ Public assets directory not found at:', publicAssetsDir);
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
