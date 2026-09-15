// SPDX-License-Identifier: GPL-2.0-or-later

import Clutter from 'gi://Clutter';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class HideCursorIdleFadeExtension extends Extension {
    enable() {
        this._lightbox = Main.screenShield._longLightbox;
        this._cursorTracker = global.backend.get_cursor_tracker();

        this._cursorInhibited = false;

        this._visibleChangedId = this._lightbox.connect(
            'notify::visible',
            () => this._syncCursor()
        );

        this._syncCursor();
    }

    disable() {
        if (this._visibleChangedId) {
            this._lightbox.disconnect(this._visibleChangedId);
            this._visibleChangedId = 0;
        }

        this._showCursor();

        this._lightbox = null;
        this._cursorTracker = null;
    }

    _syncCursor() {
        if (this._lightbox.visible)
            this._hideCursor();
        else
            this._showCursor();
    }

    _hideCursor() {
        if (this._cursorInhibited)
            return;

        const seat = Clutter.get_default_backend().get_default_seat();

        seat.inhibit_unfocus();
        this._cursorTracker.inhibit_cursor_visibility();

        this._cursorInhibited = true;

        this._createCursorActor();
    }

    _showCursor() {
        if (!this._cursorInhibited)
            return;

        const seat = Clutter.get_default_backend().get_default_seat();

        this._cursorTracker.uninhibit_cursor_visibility();
        seat.uninhibit_unfocus();

        this._cursorInhibited = false;

        this._destroyPointerActor();
    }

    _createCursorActor() {
        if (!this._cursorTracker.get_pointer_visible())
            return;

        const sprite = this._cursorTracker.get_sprite();
        if (!sprite)
            return;

        const [point] = this._cursorTracker.get_pointer();
        const [hotX, hotY] = this._cursorTracker.get_hot();
        const scale = this._cursorTracker.get_scale();
        let x = point.x - hotX * scale;
        let y = point.y - hotY * scale;

        // Match the pixel alignment used by Mutter's cursor renderer.
        const view = global.stage.get_view_at(point.x, point.y);
        if (view) {
            const layout = view.get_layout();
            const viewScale = view.get_scale();
            x = layout.x + Math.floor((x - layout.x) * viewScale) / viewScale;
            y = layout.y + Math.floor((y - layout.y) * viewScale) / viewScale;
        }

        // Keep a snapshot, as the client may update the cursor during the fade.
        const context = sprite.get_context();
        const texture = Cogl.Texture2D.new_with_size(context,
            sprite.get_width(), sprite.get_height());
        const offscreen = Cogl.Offscreen.new_with_texture(texture);
        offscreen.clear4f(Cogl.BufferBit.COLOR, 0, 0, 0, 0);
        const pipeline = Cogl.Pipeline.new(context);
        pipeline.set_layer_texture(0, sprite);
        offscreen.draw_textured_rectangle(pipeline, -1, 1, 1, -1, 0, 0, 1, 1);

        this._pointerActor = new Clutter.Actor({
            content: Clutter.TextureContent.new_from_texture(texture, null),
            x,
            y,
            width: sprite.get_width() * scale,
            height: sprite.get_height() * scale,
        });
        Main.uiGroup.add_child(this._pointerActor);
    }

    _destroyPointerActor() {
        this._pointerActor?.destroy();
        this._pointerActor = null;
    }
}
