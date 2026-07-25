# card-battler source

`TcgDisplayLayer.jsx` is the authored source for this demo. The site has no
build pipeline, so the committed `../app.js` is a one-off bundle of it. Kept
here because without it the demo is only editable by re-deriving 2,200 lines
from a minified bundle.

Rebuild after editing:

```
npm install react@18 react-dom@18 esbuild
npx esbuild entry.jsx --bundle --minify --format=iife --target=es2019 \
  --jsx=automatic --define:process.env.NODE_ENV='"production"' \
  --outfile=app.js
```

where `entry.jsx` is:

```jsx
import { createRoot } from "react-dom/client";
import TcgDisplayLayer from "./src/TcgDisplayLayer.jsx";

createRoot(document.getElementById("root")).render(<TcgDisplayLayer />);
```

`--jsx=automatic` matters: the source imports hooks by name and never imports
the `React` default, so the classic transform builds cleanly and then fails at
runtime with "React is not defined".
