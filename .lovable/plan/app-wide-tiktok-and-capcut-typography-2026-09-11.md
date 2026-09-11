# App-wide TikTok and CapCut typography

## What will change
- Bundle the official open-source TikTok Sans font locally so the app does not depend on an external font service.
- Use TikTok Sans across the complete web app, including forms, navigation, pages, and the ride experience.
- Replace the current oversized and extra-heavy heading treatment with a cleaner TikTok/CapCut-like scale: compact body text, bold but balanced headings, and readable controls.
- Keep the PUBSTORE wordmark styling distinct where it is intentionally used as branding.
- Apply the same font to generated social ad images and videos so downloaded media matches the app.

## Technical details
- Add the variable WOFF2 font and its license to local public assets.
- Define one global font token and use it in the base stylesheet and Tailwind font families.
- Normalize heading weights and letter spacing without changing page layouts or colors.
- Update canvas font stacks in the image and video renderers.
- Verify the app build and inspect representative desktop and mobile screens for clipping or layout shifts.
