# Local File Viewer

This project is a web-based local file viewer that allows you to browse and view PDF and HTML files in a clean, responsive interface. It supports persistent "read" states, flagging questions, and full-text search.

## Features
- **Local File Browsing**: Recursively traverses the `q` directory to list files.
- **PDF Viewer**: Integrated PDF.js viewer with custom UI.
- **Progress Tracking**: Marks questions as "Seen" (green) when clicked.
- **Counter**: Shows "Seen / Total" count.
- **Flagging**: Flag questions for review.
- **Search**: Filter questions by name or sequence number.
- **Static Build**: Can be built into a static site for GitHub Pages.

## Development

### Prerequisites
- Node.js (v14+)
- NPM

### Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally (Development Mode)
Starts the Express server which serves files dynamically from the file system.
```bash
npm start
```
- Access at `http://localhost:3000`

### Static Build
Generates a static version of the site in the `dist/` folder, suitable for deployment to GitHub Pages or any static host.
```bash
npm run build:static
```
- Output directory: `dist/`
- To test the static build locally:
  ```bash
  npx http-server dist -p 8080 -c-1
  ```

## Deployment
This project is configured to deploy to GitHub Pages automatically via GitHub Actions when pushing to the `ghpages` branch (or `main` if configured).

The current workflow uses `build-static.js` to generate the site.

## Project Structure
- `server.js`: Express server for local dynamic serving.
- `build-static.js`: Script to generate static site.
- `public/`: Frontend assets (HTML, CSS, JS).
- `q/`: Content directory containing PDFs.
- `dist/`: Build output (ignored by git).
