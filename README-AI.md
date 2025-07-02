# README for AI - SpilnoSchool Document Viewer

## Project Overview
**SpilnoSchool Document Viewer** is a Node.js widget builder that creates an embeddable document viewer widget. The widget supports multiple document formats including PDF, images, videos (YouTube), and SVG files.

## Architecture
- **Widget Components**: Three JavaScript files (css.js, html.js, javascript.js) that exchange data through a global `data` object
- **Build System**: Automatic assembly of components into a single HTML widget file
- **Test Environment**: Test page with iframe and interactive buttons for testing different document types
- **File Watcher**: Monitors source and test files for automatic rebuilds
- **Mock Assets**: Local PDF and SVG files for testing

## Quick Deployment Instructions for AI

### 1. Clone and Setup
```bash
git clone [REPOSITORY_URL]
cd spilnoschool-document-viewer
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
This will:
- Perform initial widget build
- Start Express server on port 3000
- Activate file watcher for automatic rebuilds
- Serve test page at http://localhost:3000

### 3. Expose for External Access
```bash
# Use the expose_port command in your environment
expose_port local_port="3000"
```
This provides a public URL for external testing.

### 4. Verification Steps
- Test page loads at the public URL
- All buttons work: "Add test documents", "Add images", "Add video", "Clear all"
- Widget displays PDF, SVG, images, and YouTube videos correctly
- File watcher triggers rebuilds when files change

## File Structure
```
spilnoschool-document-viewer/
├── src/
│   ├── components/
│   │   ├── css.js          # Widget CSS styles
│   │   ├── html.js         # Widget HTML structure  
│   │   └── javascript.js   # Widget JavaScript logic
│   └── builder.js          # Build orchestration
├── test/
│   └── index.html          # Test page with iframe
├── public/
│   └── assets/
│       ├── sample.pdf      # Mock PDF for testing
│       └── sample.svg      # Mock SVG for testing
├── dist/                   # Build output directory
│   ├── widget.html         # Assembled widget
│   └── index.html          # Test page copy
├── server.js               # Express dev server
└── package.json
```

## Key Commands
- `npm run build` - Build widget only
- `npm run dev` - Start development server with file watcher
- `npm start` - Build and start server

## File Watcher Configuration
Monitors:
- `src/components/**/*.js` - Widget source files
- `src/builder.js` - Build script
- `test/**/*.html` - Test page

## Known Issues & Solutions
- **File Reading Timing**: Builder includes retry mechanism for file system timing issues during rebuilds
- **Require Cache**: Automatic cache clearing prevents stale module loading during development

## Testing Workflow
1. Start server with `npm run dev`
2. Expose port 3000 for external access
3. Test all document types using the interactive buttons
4. Verify file watcher detects changes and rebuilds automatically
5. Confirm all functionality works through public URL

## Widget Integration
The built widget (`dist/widget.html`) can be embedded in any webpage using an iframe. It communicates via postMessage API for document loading and management.

## Development Notes
- Server runs on port 3000 by default
- All changes trigger automatic rebuilds
- Test page includes status messages and document list
- Mock assets are served from `/assets/` endpoint
- Widget supports PDF, images, YouTube videos, and SVG files
