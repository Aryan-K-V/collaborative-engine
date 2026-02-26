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
- **Mocha & Matcha theme:** a dark, coffee-toned look with a matcha green accent.

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
| `src/index.css`   | Color and font tokens, and the background gradient                              |
| `src/App.css`     | Layout, the page, button and ribbon styles, and Quill theme overrides           |

`Editor` creates a `Y.Doc`, a `WebsocketProvider` for the document ID and a Quill
editor, and connects them with `QuillBinding`. The text is stored in the shared
type `ydoc.getText('quill')`. Cursors and presence go through the provider's
awareness: after the first sync, each client claims a random name and a cursor
color that nobody in the document is using yet. Quill's toolbar is moved into the
page's top row so it sits next to the status and the ribbons. Everything is torn
down when the component unmounts or the document changes.

## Design

The app uses the dark **Mocha & Matcha** theme. The editor is a Cocoa page on a
Dark Mocha canvas that fades down from a warm brown gradient.

| Token        | Name           | Hex       | Used for                                  |
| ------------ | -------------- | --------- | ----------------------------------------- |
| `--base`     | Deep Espresso  | `#1E140E` | Darkest layer; text on the green button   |
| `--desk`     | Dark Mocha     | `#241811` | Page background                           |
| `--desk-top` | Warm brown     | `#5A3F2C` | Top of the background gradient (400px)    |
| `--page`     | Cocoa          | `#32231A` | Editor surface                            |
| `--hover`    | Milk Chocolate | `#463327` | Hover and active states, dividers         |
| `--pen`      | Matcha Green   | `#1ED760` | Copy link button, focus, active tools, status |
| `--ink`      | Frosted Cream  | `#F5EFEA` | Primary text                              |
| `--graphite` | Warm Taupe     | `#A89B92` | Secondary text and icons                  |

Everything is set in [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans):
700 for headings and buttons, 500 for interface text, 400 for document text. It
loads from Google Fonts in `index.html` and falls back to Inter or the system font
when offline. The tokens are CSS variables on `:root` in `src/index.css`; change
them there rather than in component styles. The animations (a ribbon dropping in
when someone joins, and the Copy link button growing slightly on hover) are turned
off under `prefers-reduced-motion`.
