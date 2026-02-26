# Frontend

React + Vite client for the collaborative editor. It uses Quill for editing and
Yjs (via `y-websocket`) to sync with the sync service.

## Features

- **Live co-editing:** every collaborator's cursor and selection shows in their color.
- **Presence ribbons:** each person in the document is a bookmark ribbon hanging
  over the page's top edge, in their cursor color. Yours is the longest. Hover,
  tap or tab to a ribbon to see the name.
- **Connection status:** connecting, syncing, connected or offline. Edits made
  offline are kept and sync when the connection returns.
- **Shareable documents:** the document ID lives in the URL (`?doc=<id>`). Opening
  the app without one starts a new document. **Copy link** copies the URL.
- **Light and dark themes** that follow the system setting.

## Running

The sync service must be running first (see the [main README](../README.md)).

```sh
cp .env.example .env   # optional; defaults to ws://localhost:3001/doc
npm install
npm run dev
```

Open the printed URL. A new document ID is generated and put in the URL
(`?doc=<id>`); open the same link in another tab or browser to edit together.

| Script            | What it does                         |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the dev server with hot reload |
| `npm run build`   | Build for production into `dist/`    |
| `npm run preview` | Serve the production build locally   |
| `npm run lint`    | Run ESLint                           |

## Configuration

| Variable        | Default                   | Description                                    |
| --------------- | ------------------------- | ---------------------------------------------- |
| `VITE_SYNC_URL` | `ws://localhost:3001/doc` | Sync service WebSocket URL (`wss://` on HTTPS) |

Vite reads this at build time, so rebuild after changing it.

## How it works

| File              | Role                                                                            |
| ----------------- | ------------------------------------------------------------------------------- |
| `src/App.jsx`     | Reads or creates the `?doc=` ID, renders the header and the share link          |
| `src/Editor.jsx`  | Connects to the sync service and binds the shared document to Quill             |
| `src/index.css`   | Color and font tokens, with dark-mode overrides                                 |
| `src/App.css`     | Layout, the page and ribbon styles, and Quill theme overrides                   |

`Editor` creates a `Y.Doc`, a `WebsocketProvider` for the document ID and a Quill
editor, and connects them with `QuillBinding`. The text is stored in the shared
type `ydoc.getText('quill')`. Cursors and presence go through the provider's
awareness: after the first sync, each client claims a random name and a cursor
color that nobody in the document is using yet. Quill's toolbar is moved into the
page's top row so it sits next to the status and the ribbons. Everything is torn
down when the component unmounts or the document changes.

## Design

The document is an off-white page on a slate-blue desk. Content is set in
[Literata](https://fonts.google.com/specimen/Literata) at a book-width line, and
the interface uses [Schibsted Grotesk](https://fonts.google.com/specimen/Schibsted+Grotesk).
Both load from Google Fonts in `index.html` and fall back to Georgia and the
system font when offline. Colors are CSS variables on `:root` in `src/index.css`;
change them there rather than in component styles. The only animation (a ribbon
dropping in when someone joins) is turned off under `prefers-reduced-motion`.
