const express = require('express');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');

const app = express();
app.use(express.json()); // Enable JSON body parsing

// Load configuration
let config = { contentFolder: 'q', port: 3000 };
try {
  const configFile = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
  config = { ...config, ...JSON.parse(configFile) };
  console.log('Loaded setup from config.json');
} catch (e) {
  console.log('Using default setup (config.json not found or invalid)');
}

const PORT = process.env.PORT || config.port;
const FILE_DIR = path.resolve(process.env.FILE_DIR || path.join(__dirname, config.contentFolder));

// Serve files from `public` at the web root so assets like /pdf-viewer.html are reachable
app.use(express.static(path.join(__dirname, 'public')));

// API to expose config to frontend
app.get('/config', (req, res) => res.json(config));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function buildTree(dir, relPath = '') {
  let entries = await fs.promises.readdir(dir, { withFileTypes: true });
  // sort entries by name using natural numeric ordering so '2' < '10' etc.
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
  // sort children: directories first, then files. Files sorted by first numeric token when available.
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
      // both directories: natural compare
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    }
    // directory before file
    return a.type === 'directory' ? -1 : 1;
  });

  return { name: path.basename(dir), path: relPath, children };
}

app.get('/list', async (req, res) => {
  try {
    const tree = await buildTree(FILE_DIR, '');
    res.json(tree.children || []);
  } catch (err) {
    res.status(500).json({ error: 'Unable to read directory', details: err.message });
  }
});

function safeResolve(relPath) {
  const decoded = decodeURIComponent(relPath || '');
  const target = path.normalize(path.join(FILE_DIR, decoded));
  if (!target.startsWith(FILE_DIR)) return null;
  return target;
}

app.get('/file', (req, res) => {
  const p = req.query.path;
  const resolved = safeResolve(p);
  if (!resolved) return res.status(400).send('Invalid path');
  fs.stat(resolved, (err, st) => {
    if (err || !st.isFile()) return res.status(404).send('Not found');
    const mt = mime.lookup(resolved) || 'application/octet-stream';
    res.type(mt);
    if (mt === 'application/pdf') {
      res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(resolved) + '"');
    }
    res.sendFile(resolved);
  });
});

app.get('/view', (req, res) => {
  // viewer page that embeds /file
  const p = req.query.path || '';
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Viewer</title></head><body style="margin:0;height:100vh"><iframe src="/file?path=${encodeURIComponent(p)}" style="border:0;width:100%;height:100%"></iframe></body></html>`);
});

app.listen(PORT, () => {
  console.log(`File viewer running on http://localhost:${PORT}`);
  console.log(`Serving files from: ${FILE_DIR}`);
});
