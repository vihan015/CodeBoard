# DSA Board

A minimal whiteboard for DSA and competitive-programming problems. React + Vite, no backend.
Everything (board, images, code, theme) is saved in the browser's localStorage.

## Run
    npm install
    npm run dev        # http://localhost:5173

## Build and deploy
    npm run build      # outputs ./dist (static files)
Upload `dist/` to Netlify, Vercel, Cloudflare Pages, or GitHub Pages.

## Structure
- `src/engine.js`      canvas engine (drawing, selection, arrows, undo, storage), plain JS
- `src/structures.js`  builders for array, matrix, tree, graph, map, set, queue, stack, linked list
- `src/App.jsx`        React state and layout; `src/components/*` UI panels
