const express = require('express');
const chokidar = require('chokidar');
const path = require('path');
const { buildWidget } = require('./src/builder');

const app = express();
const PORT = 3000;

app.use('/dist', express.static(path.join(__dirname, 'dist')));
app.use('/test', express.static(path.join(__dirname, 'test')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use(express.static(path.join(__dirname, 'test')));

app.post('/api/rebuild', (req, res) => {
  console.log('🔄 Manual rebuild triggered...');
  const success = buildWidget();
  res.json({ success, timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'test', 'index.html'));
});

let server;

function startServer() {
  server = app.listen(PORT, () => {
    console.log(`🚀 Development server running at http://localhost:${PORT}`);
    console.log(`📋 Test page: http://localhost:${PORT}`);
    console.log(`🔧 Widget: http://localhost:${PORT}/dist/widget.html`);
  });
}

function setupFileWatcher() {
  console.log('👀 Setting up file watcher...');
  
  const watcher = chokidar.watch([
    'src/widget/**/*.js',
    'src/builder.js',
    'test/**/*.html'
  ], {
    ignored: /node_modules/,
    persistent: true,
    ignoreInitial: true
  });

  watcher.on('change', (filePath) => {
    console.log(`📝 File changed: ${filePath}`);
    console.log('🔄 Rebuilding widget...');
    
    const fullPath = path.resolve(filePath);
    delete require.cache[fullPath];
    
    delete require.cache[require.resolve('./src/builder')];
    delete require.cache[require.resolve('./src/widget/css.js')];
    delete require.cache[require.resolve('./src/widget/javascript.js')];
    delete require.cache[require.resolve('./src/widget/html.js')];
    
    const { buildWidget } = require('./src/builder');
    const success = buildWidget();
    
    if (success) {
      console.log('✅ Auto-rebuild completed successfully');
    } else {
      console.log('❌ Auto-rebuild failed');
    }
  });

  watcher.on('error', error => {
    console.error('❌ File watcher error:', error);
  });

  console.log('✅ File watcher active');
}

console.log('🏗️  Performing initial build...');
const initialBuild = buildWidget();

if (initialBuild) {
  console.log('✅ Initial build successful');
  startServer();
  setupFileWatcher();
} else {
  console.error('❌ Initial build failed');
  process.exit(1);
}

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  if (server) {
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
