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
    }

    _showCursor() {
        if (!this._cursorInhibited)
            return;

        const seat = Clutter.get_default_backend().get_default_seat();

        this._cursorTracker.uninhibit_cursor_visibility();
        seat.uninhibit_unfocus();

        this._cursorInhibited = false;
    }
}
