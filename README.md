# Idle Cursor Fade

A GNOME Shell extension that fades the mouse cursor together with the screen when GNOME becomes idle.

GNOME Shell's idle fade does not normally affect the cursor, as the cursor is rendered separately by Mutter. This extension temporarily replaces the real cursor with a fake cursor when the idle fade starts, allowing it to fade out with the rest of the screen.

On physical displays, the real cursor stays visible until a frame containing the snapshot has been presented. This avoids a gap between hiding the hardware cursor and displaying its replacement. Offscreen sessions switch cursors during the same paint.

## Compatibility

- GNOME Shell 50
- No additional runtime dependencies or settings

## Installation

Build and install the extension:

```sh
make install
```

Then log out and back and enable it:

```sh
gnome-extensions enable idle-cursor-fade@tobih7
```

To disable it:

```sh
gnome-extensions disable idle-cursor-fade@tobih7
```

## Testing

To trigger the idle fade manually, open Looking Glass (press `Alt+F2`, then enter `lg`) and run:

```js
GLib.timeout_add_once(GLib.PRIORITY_DEFAULT, 5000, () => Main.screenShield._onStatusChanged(3));
```

This starts the idle fade after five seconds, which makes it easier to test the cursor transition without waiting for the normal idle timeout.

## License

GPL-2.0-or-later
