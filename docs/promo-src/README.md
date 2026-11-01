# Email promo images

HTML sources for `frontend/public/promo/roadmap-*.png` (used by the `[[roadmap-promo]]` email card).
Edit the HTML, then re-render at 1200px wide:

```bash
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless=new --hide-scrollbars --window-size=1200,520 --screenshot=frontend/public/promo/roadmap-hero.png "file://$PWD/docs/promo-src/hero.html"
"$CH" --headless=new --hide-scrollbars --window-size=1200,430 --screenshot=frontend/public/promo/roadmap-companies.png "file://$PWD/docs/promo-src/companies.html"
"$CH" --headless=new --hide-scrollbars --window-size=1200,430 --screenshot=frontend/public/promo/roadmap-inside.png "file://$PWD/docs/promo-src/inside.html"
```
