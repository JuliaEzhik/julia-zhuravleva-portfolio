# Portfolio — Domino Intro

Cinematic Three.js domino chain reaction with a title reveal end card, followed by selected projects, a phone-screen gallery, and a contact section for Julia Zhuravleva's web portfolio. Dark studio aesthetic, soft shadows, responsive layout, and a scroll-driven burning fuse that connects the main section headers.

## Run locally

Serve the folder over HTTP (required for ES modules and the Three.js CDN import map):

```bash
cd "/Users/ezhik/my portfolio"
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

Any static file server works (`npx serve`, VS Code Live Server, etc.).

## Dependencies

- [Three.js r170](https://threejs.org/) loaded from jsDelivr CDN (see `index.html` import map)
- No npm install or build step

## File structure

```
index.html              Page shell, fuse overlay, canvas host, replay button, title reveal, project cards, gallery, contact form
styles.css              Dark UI, scroll fuse effects, hero layout, project/gallery/contact sections, responsive styles
images/                 Gallery screenshots used in the phone mockups
js/
  main.js               Bootstrap — wires scene, scroll fuse, animation, UI, contact mailto form
  config.js             Colors, title text, timing (customize here)
  DominoScene.js        Renderer, camera, lights, table, domino row
  DominoPiece.js        Single domino mesh + fall / end poses
  AnimationController.js  Chain-reaction keyframes + camera shake
  UIController.js       Replay button + title reveal
```

## Replay

Click **Replay** after the animation finishes. The scene resets, dominoes return upright, and the full cascade runs again.

## Scroll fuse

The decorative fuse overlay is driven by `js/main.js`. It measures elements marked with `data-fuse-anchor`, draws an SVG path between them, and maps scroll position to the burned path, spark, ember trail, smoke puffs, and section `is-ignited` reveal states.

## Customize title

Edit `js/config.js`:

```js
export const TITLE_TEXT = 'Your Name';   // REPLACE
export const SUBTITLE_TEXT = 'Portfolio';
```

## Customize projects

Edit the `.project-card` articles in `index.html` to update portfolio items. Each card includes a title, category, description, service tags, and an external project link.

## Customize gallery

Add or replace screenshots in `images/`, then update the `.screen-card` figures in `index.html` with the matching relative path, alt text, and caption. Tall mobile screenshots work best with the current phone mockup layout.

## Customize contact

The contact section uses icon-enhanced contact cards for Julia's email, `juliaezhik09@gmail.com`, plus Telegram and WhatsApp links, alongside the project inquiry form.

- `index.html` contact email link, Telegram link, WhatsApp badge link, form `action`, and form `data-recipient`
- `js/main.js` `CONTACT_EMAIL_PLACEHOLDER`

The form validates name, email, and message in the browser, then opens the visitor's email app with a prefilled `mailto:` message. There is no backend or message storage. The WhatsApp UI intentionally shows only a message label, not the phone number.

## Customize colors

Edit the `DOMINO_COLORS` array in `js/config.js`. Each entry has:

- `front` — colorful face shown toward the camera
- `edge` — side face shade

Adjust domino count by changing the array length (or set `CONFIG.dominoCount`).

## Timing & motion

Also in `js/config.js`:

- `CONFIG.timing.holdBeforeStart` — pause before first fall (default 1s)
- `CONFIG.timing.fallDuration` — per-domino fall time
- `CONFIG.timing.impactAngleDeg` — collision angle that triggers the next domino
- `CONFIG.camera` — front-of-chain view (camera on **-Z**, row along **+X**)

## Accessibility

When `prefers-reduced-motion: reduce` is enabled, the domino animation is skipped, the final pose + title are shown immediately, and the scroll fuse is hidden while page sections remain visible.

## Browser support

Modern browsers with WebGL 2 and ES module support (Chrome, Firefox, Safari, Edge).
