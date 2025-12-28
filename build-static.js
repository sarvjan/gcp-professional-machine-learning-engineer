const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// Load configuration
let config = { contentFolder: 'q', port: 3000 };
try {
    const configFile = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
    config = { ...config, ...JSON.parse(configFile) };
    console.log('Loaded config from config.json');
} catch (e) {
    console.log('Using default config');
}

const CONTENT_DIR = path.resolve(__dirname, config.contentFolder);
const DIST_DIR = path.resolve(__dirname, 'dist');
const PUBLIC_DIR = path.resolve(__dirname, 'public');

// Create dist directory
if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Build file tree (same logic as server.js)
async function buildTree(dir, relPath = '') {
    let entries = await fs.promises.readdir(dir, { withFileTypes: true });
    entries = entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    const children = [];

    for (const e of entries) {
        const name = e.name;
        const childRel = relPath ? path.join(relPath, name) : name;
        const childAbs = path.join(dir, name);

        if (e.isDirectory()) {
            const subtree = await buildTree(childAbs, childRel);
            if (subtree.children && subtree.children.length) {
                children.push({ name, path: childRel, type: 'directory', children: subtree.children });
            }
        } else if (e.isFile()) {
            const mt = mime.lookup(name) || 'application/octet-stream';
            if (mt.startsWith('text/html') || mt === 'application/pdf') {
                children.push({ name, path: childRel, type: 'file', mime: mt });
            }
        }
    }

    // Sort children
    function extractNumber(s) {
        const m = String(s).match(/(\d+)/);
        return m ? parseInt(m[0], 10) : Number.POSITIVE_INFINITY;
    }

    children.sort((a, b) => {
        if (a.type === b.type) {
            if (a.type === 'file') {
                const na = extractNumber(a.name);
                const nb = extractNumber(b.name);
                if (na !== nb) return na - nb;
                return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            }
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        }
        return a.type === 'directory' ? -1 : 1;
    });

    return { name: path.basename(dir), path: relPath, children };
}

// Copy directory recursively
function copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function build() {
    console.log('Building static site...');
    console.log(`Content folder: ${CONTENT_DIR}`);
    console.log(`Output folder: ${DIST_DIR}`);

    // 1. Generate file tree
    console.log('\n1. Generating file tree...');
    const tree = await buildTree(CONTENT_DIR, '');
    const fileTree = tree.children || [];

    // 2. Create data.json with config and file tree
    console.log('2. Creating data.json...');
    const data = {
        config: {
            appTitle: config.appTitle || 'Local File Viewer',
            themeColor: config.themeColor || '#1f6feb'
        },
        fileTree: fileTree
    };

    fs.writeFileSync(
        path.join(DIST_DIR, 'data.json'),
        JSON.stringify(data, null, 2)
    );

    // 3. Copy content folder to dist/q
    console.log('3. Copying content files...');
    const distContentDir = path.join(DIST_DIR, config.contentFolder);
    copyDirRecursive(CONTENT_DIR, distContentDir);

    // 4. Copy public folder files and directories
    console.log('4. Copying public folder...');
    const publicFiles = fs.readdirSync(PUBLIC_DIR);
    for (const file of publicFiles) {
        const srcPath = path.join(PUBLIC_DIR, file);
        const destPath = path.join(DIST_DIR, file);

        if (fs.statSync(srcPath).isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else if (fs.statSync(srcPath).isFile()) {
            fs.copyFileSync(srcPath, destPath);
        }
    }

    // 5. Create modified index.html for static mode
    console.log('5. Creating static index.html...');
    let indexHtml = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');

    // Modify the load() function to use static data
    const staticLoadFunction = `
    async function load() {
      // Load static data
      try {
        const res = await fetch('./data.json');
        if (!res.ok) { 
          document.getElementById('tiles').textContent = 'Failed to load data'; 
          return; 
        }
        const data = await res.json();
        
        // Apply config
        if (data.config.appTitle) document.title = data.config.appTitle;
        if (data.config.themeColor) document.documentElement.style.setProperty('--accent', data.config.themeColor);
        
        // Load file tree
        const tree = data.fileTree;
        flatFiles = [];
        dfsCollect(tree, flatFiles);

        loadFromStorage(); // Load flags and read status from localStorage

        loadFromStorage(); // Load flags and read status from localStorage

        updateCounts();
        renderTiles(flatFiles);
        if (flatFiles.length) openInViewer(0);
      } catch (err) {
        document.getElementById('tiles').innerHTML = \`<div style="color:red;padding:20px">Error loading files: \${err.message}</div>\`;
      }
    }`;

    // Replace the load() function
    indexHtml = indexHtml.replace(
        /async function load\(\) \{[\s\S]*?\n    \}/,
        staticLoadFunction.trim()
    );

    // Update file path to use relative paths (./q/ instead of /file?path=)
    indexHtml = indexHtml.replace(
        /iframe\.src = '\/file\?path=' \+ encodeURIComponent\(f\.path\);/,
        `iframe.src = './${config.contentFolder}/' + encodeURIComponent(f.path);`
    );

    // Update PDF viewer path with cache busting
    indexHtml = indexHtml.replace(
        /iframe\.src = '\/pdf-viewer\.html\?path=' \+ encodeURIComponent\(f\.path\);/,
        `iframe.src = './pdf-viewer.html?v=${Date.now()}&path=' + encodeURIComponent(f.path);`
    );

    fs.writeFileSync(path.join(DIST_DIR, 'index.html'), indexHtml);

    // 6. Check if pdf-viewer.html exists and update it
    const pdfViewerPath = path.join(PUBLIC_DIR, 'pdf-viewer.html');
    if (fs.existsSync(pdfViewerPath)) {
        console.log('6. Updating pdf-viewer.html...');
        let pdfViewerHtml = fs.readFileSync(pdfViewerPath, 'utf8');

        // Update file fetch path in pdf-viewer.html
        pdfViewerHtml = pdfViewerHtml.replace(
            /const pdfUrl = '\/file\?path='[\s\S]*?;/,
            `const pdfUrl = '/${config.contentFolder}/' + encodeURIComponent(relPath);`
        );

        fs.writeFileSync(path.join(DIST_DIR, 'pdf-viewer.html'), pdfViewerHtml);
    }

    console.log('\n✅ Static build complete!');
    console.log(`📁 Output directory: ${DIST_DIR}`);
    console.log(`📊 Total files: ${fileTree.length}`);
    console.log('\nTo test locally, run:');
    console.log('  npx http-server dist -p 8080');
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
