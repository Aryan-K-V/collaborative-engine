# Deploying online

This puts the editor on the public internet using free tiers, with no credit card:

| Piece        | Host                                              | What it runs                        |
| ------------ | ------------------------------------------------- | ----------------------------------- |
| Editor       | [Render](https://render.com) static site          | The built React frontend            |
| Sync service | Render web service                                | `sync-service/` (WebSockets)        |
| MongoDB      | [MongoDB Atlas](https://www.mongodb.com/atlas) M0 | Saved documents                     |
| Redis        | [Upstash](https://upstash.com)                    | Relays changes between sync servers |

Both Render services are defined in [`render.yaml`](render.yaml). The Core API
isn't deployed, since the editor doesn't use it yet.

The whole setup takes about 20 minutes. Keep a text file open to paste the two
connection strings into as you go.

## 1. MongoDB Atlas

1. Sign up at [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register).
2. Create a cluster and choose the free **M0** tier. Pick the region closest to
   where you'll run Render (step 3), for example AWS Oregon or Frankfurt.
3. **Database Access → Add New Database User.** Choose password authentication.
   Use a password with only letters and numbers, or you'll have to URL-encode it.
4. **Network Access → Add IP Address → Allow Access from Anywhere** (`0.0.0.0/0`).
   Render's free tier has no fixed IP address, so a narrower rule would block it.
5. **Database → Connect → Drivers.** Copy the connection string and put your
   password in place of `<db_password>`. It looks like:

   ```
   mongodb+srv://collab:yourpassword@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```

   This is your `MONGO_URI`. You don't need to add a database name; the service
   always uses `crdt_store`.

## 2. Upstash Redis

1. Sign up at [console.upstash.com](https://console.upstash.com).
2. **Create Database** (Redis). Pick the region closest to your Render region.
3. On the database page, copy the connection URL that starts with `rediss://`
   (two s's, meaning TLS). It looks like:

   ```
   rediss://default:AbCdEf123@example-12345.upstash.io:6379
   ```

   This is your `REDIS_URL`.

## 3. Render

1. Sign up at [dashboard.render.com](https://dashboard.render.com) with your GitHub
   account, and allow access to the `collaborative-engine` repository.
2. **New → Blueprint**, then choose the repository. Render reads `render.yaml` and
   lists two services, `collab-sync` and `collab-editor`.
3. Fill in the values it asks for:

   | Variable          | Value                                                        |
   | ----------------- | ------------------------------------------------------------ |
   | `MONGO_URI`       | The Atlas string from step 1                                 |
   | `REDIS_URL`       | The Upstash string from step 2                               |
   | `ALLOWED_ORIGINS` | Leave empty for now                                          |
   | `VITE_SYNC_URL`   | `wss://collab-sync.onrender.com/doc`                         |

4. **Apply.** The first deploy takes a few minutes.

## 4. Check the addresses

Render names each service `<name>.onrender.com`, but adds a random suffix if the
name is taken, for example `collab-sync-x7k2.onrender.com`.

1. Open the **collab-sync** service and copy its URL. Add `/health` to the end and
   open it; you should see `{"status":"ok"}`.
2. If its URL isn't exactly `https://collab-sync.onrender.com`, open
   **collab-editor → Environment**, set `VITE_SYNC_URL` to the real address with
   `wss://` in front and `/doc` at the end, then **Manual Deploy → Clear build cache
   & deploy**. The frontend reads this value when it's built, so it needs a rebuild.
3. Open the **collab-editor** URL. The page should say **Connected**.

## 5. Lock the sync service to your editor

Without this, any website could connect to your sync service from a browser.

Open **collab-sync → Environment**, set `ALLOWED_ORIGINS` to the editor's address
(for example `https://collab-editor.onrender.com`, with no path), and save. Render
redeploys it automatically. To allow more than one address, separate them with
commas.

## 6. Try it

Open the editor URL, then open the same `?doc=` link on your phone or in another
browser and type in both. You can also run the end-to-end test against the live
service from your computer:

```sh
cd sync-service
node test-crdt.js wss://collab-sync.onrender.com/doc
```

After this, every push to `main` redeploys both services automatically.

## What to expect on the free tiers

- **Cold starts.** Render's free web services sleep after 15 minutes without
  traffic. The first visitor after that sees **Connecting…** for up to about a
  minute while it wakes. Documents are saved before it sleeps.
- **Limits.** Atlas M0 stores up to 512 MB. Upstash's free tier has a monthly
  command limit, and every edit uses at least one command; check the current
  numbers on [Upstash's pricing page](https://upstash.com/pricing).
- **No accounts.** Anyone with a document link can read and edit it.

## Troubleshooting

| Symptom                                            | Likely cause and fix                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Editor stays on **Connecting…** or **Offline**     | Wrong `VITE_SYNC_URL`. It must start with `wss://` and end with `/doc`. Rebuild after fixing. |
| Worked, then went **Offline** after step 5         | `ALLOWED_ORIGINS` doesn't match the editor's address. The sync logs show `Rejected connection from origin …` with the exact value to use. |
| Sync deploy fails with `MongoServerSelectionError` | Atlas Network Access isn't `0.0.0.0/0`, or the password in `MONGO_URI` is wrong.     |
| Sync deploy fails with `ECONNRESET` or `WRONGPASS` | `REDIS_URL` must be the `rediss://` URL, including the password.                    |
| Build fails mentioning the Node version            | `NODE_VERSION` in `render.yaml` must be 22 or newer for Vite.                        |
