# Public website

The `docs/` directory contains the English production website. It uses relative asset paths and loads no platform SDK or ads. The separately packaged CrazyGames builds remain in `releases/`.

Enable GitHub Pages at https://github.com/Bekislam09/1-homee/settings/pages:

1. Under **Build and deployment**, select **Deploy from a branch**.
2. Select branch **main**, folder **/docs**, and click **Save**.
3. Wait for the Pages deployment to complete. The expected address is https://bekislam09.github.io/1-homee/.

The files have been tested over HTTP at the `/1-homee/` subpath with actual keyboard destruction. Public deployment and its status cannot be verified from the current cloud environment: its enforced network policy blocks `api.github.com` and `bekislam09.github.io`. The Git proxy can push repository files but does not provide access to Pages settings. Do not treat the expected address as confirmation of an active website.

To update the website after changing the game:

```sh
npm test
npm run build -- --outDir docs --emptyOutDir
touch docs/.nojekyll
```

Commit and push the updated `docs/` files. Once Pages is enabled with the above source, subsequent pushes deploy that folder automatically.
