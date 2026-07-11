# Downey Control Panel

Wall-mounted smart home dashboard on a CrowPanel ESP32 Display-7-inch
(DIS08070H), bridged into Apple Home over Matter/Thread via a Seeed XIAO
ESP32C6.

- `firmware/display-panel/` — ESP-IDF + LVGL UI: time, weather, timer,
  med reminders, home controls.
- `firmware/matter-bridge/` — ESP-IDF + esp-matter bridge on the XIAO C6.
- `web/` — Cloudflare Worker + GitHub Actions backend that turns NFC tag
  scans into medication-taken records, served via GitHub Pages.
- `docs/` — setup and protocol documentation.
