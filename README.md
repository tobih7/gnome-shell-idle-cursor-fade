# Hide Cursor During Idle Fade

A GNOME Shell extension that hides the mouse cursor while GNOME fades the
screen to black after becoming idle. Cursor visibility is restored when the
fade ends or the extension is disabled.

## Compatibility

- GNOME Shell 50
- No additional runtime dependencies or settings

The extension uses GNOME Shell's internal `Main.screenShield._longLightbox`
object. Support can therefore break depending on GNOME version.

## Install locally

```sh
./build.sh
gnome-extensions install --force build/hide-cursor-idle-fade@tobi.shell-extension.zip
```

Log out and back in so GNOME Shell loads the installed code, then enable it:

```sh
gnome-extensions enable hide-cursor-idle-fade@tobi
```

To disable it:

```sh
gnome-extensions disable hide-cursor-idle-fade@tobi
```
