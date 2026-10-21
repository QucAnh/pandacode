# Arch Linux AppImage build

The published `PandaCode-Linux-x86_64.AppImage` is built on Ubuntu 22.04 and
bundles that distribution's GTK 3 and WebKitGTK 4.1. On Arch-based systems with a
newer Mesa, the bundled GTK fails to create an EGL display and the web process
aborts before the first paint:

```
Could not create default EGL display: EGL_BAD_PARAMETER. Aborting...
```

The window opens blank. Nothing is wrong with the provider CLIs: the failure
happens before the application UI loads.

## Fix

Build the AppImage on the Arch host instead of running the Ubuntu-built one.
Linking against the host's GTK/WebKitGTK produces matching EGL behaviour.

```sh
sudo pacman -S --needed base-devel webkit2gtk-4.1 libappindicator-gtk3 \
  librsvg patchelf cmake

git clone https://github.com/aicodeking/pandacode.git
cd pandacode
npm ci
```

Two bundler steps need adjusting on Arch, otherwise `linuxdeploy` aborts:

1. Its bundled `strip` cannot parse `.relr.dyn` sections in current Arch
   libraries. Build with `NO_STRIP=1`.
2. The `gtk` plugin looks up `gdk-pixbuf` under the Debian path
   (`/usr/lib/x86_64-linux-gnu/...`). That directory does not exist on Arch, so
   the plugin exits 1. Skipping the plugin builds an AppImage that uses the
   host's GTK/WebKitGTK instead of bundling its own.

Build without the gtk plugin by wrapping the cached linuxdeploy binary:

```sh
# ~/.cache/tauri/linuxdeploy-x86_64.AppImage -> wrapper that drops "--plugin gtk"
mv ~/.cache/tauri/linuxdeploy-x86_64.AppImage ~/.cache/tauri/linuxdeploy-real.AppImage
cat > ~/.cache/tauri/linuxdeploy-x86_64.AppImage <<'EOF'
#!/bin/sh
real="$HOME/.cache/tauri/linuxdeploy-real.AppImage"
out=""; skip=0
for a in "$@"; do
    if [ "$skip" = "1" ]; then
        skip=0; [ "$a" = "gtk" ] && continue; out="$out --plugin $a"; continue
    fi
    case "$a" in --plugin) skip=1 ;; *) out="$out $a" ;; esac
done
exec "$real" $out
EOF
chmod +x ~/.cache/tauri/linuxdeploy-x86_64.AppImage

NO_STRIP=1 npx tauri build --bundles appimage
```

Output:

```
src-tauri/target/release/bundle/appimage/PandaCode_<version>_amd64.AppImage
```

The AppImage is built from the host's Arch libraries and expects the host's
`webkit2gtk-4.1` and `gtk3`. It is intended for Arch and Arch-derived
distributions, not as a replacement for the upstream portable build.

## Verification

The built AppImage was launched on Arch with Mesa 26.2.5 and Intel UHD 620:

- the window paints the project picker instead of a blank frame
- Settings → Agents reports `opencode v2.1.2` at `~/.npm-global/bin/opencode`
- the OpenCode model list loads the free catalog, including
  `opencode/deepseek-v4.1-flash-free`

## Fork notice

This is a fork of [PandaCode](https://github.com/aicodeking/pandacode), used to
publish an Arch-local AppImage build. Upstream is unmodified; only this note and
the built release asset differ.
