// SPDX-License-Identifier: GPL-2.0-or-later

import Clutter from "gi://Clutter";
import Cogl from "gi://Cogl";

import { Extension, InjectionManager } from "resource:///org/gnome/shell/extensions/extension.js";
import { PresenceStatus } from "resource:///org/gnome/shell/misc/gnomeSession.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

export default class IdleCursorFadeExtension extends Extension {
    enable() {
        this._screenShield = Main.screenShield;
        this._lightbox = this._screenShield._longLightbox;
        this._cursorTracker = global.backend.get_cursor_tracker();

        this._cursorInhibited = false;
        this._pointerActor = null;
        this._handoff = null;

        this._injections = new InjectionManager();
        const extension = this;

        this._injections.overrideMethod(
            this._screenShield,
            "_onStatusChanged",
            (original) =>
                function (status) {
                    // Snapshot the client cursor before the modal grab changes it.
                    if (status === PresenceStatus.IDLE && !extension._lightbox.visible) extension._preparePointerFade();

                    try {
                        return original.call(this, status);
                    } finally {
                        if (!extension._lightbox.visible) extension._stopPointerFade();
                    }
                },
        );

        this._injections.overrideMethod(this._screenShield, "_activateFade", (original) => (lightbox, time) => {
            if (lightbox === extension._lightbox) extension._queueCursorHandoff();

            return original.call(this, lightbox, time);
        });

        this._injections.overrideMethod(this._screenShield, "_continueDeactivate", (original) => (animate) => {
            extension._stopPointerFade();
            return original.call(this, animate);
        });

        this._visibleChangedId = this._lightbox.connect("notify::visible", () => {
            if (!this._lightbox.visible) this._stopPointerFade();
        });

        this._activeChangedId = this._lightbox.connect("notify::active", () => {
            if (this._lightbox.active) this._destroyPointerActor();
        });

        this._monitorsChangedId = Main.layoutManager.connect("monitors-changed", () => this._stopPointerFade());
    }

    disable() {
        if (this._visibleChangedId) {
            this._lightbox.disconnect(this._visibleChangedId);
            this._visibleChangedId = 0;
        }

        if (this._activeChangedId) {
            this._lightbox.disconnect(this._activeChangedId);
            this._activeChangedId = 0;
        }

        Main.layoutManager.disconnect(this._monitorsChangedId);
        this._monitorsChangedId = 0;

        this._injections.clear();
        this._injections = null;

        this._stopPointerFade();

        this._screenShield = null;
        this._lightbox = null;
        this._cursorTracker = null;
    }

    _preparePointerFade() {
        try {
            this._createPointerActor();
        } catch (error) {
            this._destroyPointerActor();
            console.error("Could not snapshot the idle cursor", error);
        }
    }

    _queueCursorHandoff() {
        if (!this._pointerActor || this._cursorInhibited || this._handoff) return;

        const handoff = { paintId: 0, views: null, callbacks: new Map() };
        this._handoff = handoff;

        // Hiding a hardware cursor takes effect independently of scene
        // rendering. Keep it visible until its replacement reaches the screen.
        handoff.paintId = global.stage.connect("before-paint", (_stage, view) => {
            if (!this._pointerActor.is_mapped()) return;

            // A cursor can straddle monitors. Wait for all of them, even if
            // they paint at different refresh rates.
            handoff.views ??= new Set(this._pointerActor.peek_stage_views());
            if (!handoff.views.has(view) || handoff.callbacks.has(view)) return;

            const framebuffer = view.get_onscreen();
            if (framebuffer instanceof Cogl.Onscreen) {
                this._waitForCursorFrame(handoff, view, framebuffer);
            } else {
                // Offscreen views (headless/devkit) paint the real cursor and
                // the snapshot into the same frame; switch before that paint.
                this._cursorViewReady(handoff, view);
            }
        });
    }

    _waitForCursorFrame(handoff, view, framebuffer) {
        const frameCounter = framebuffer.get_frame_counter();
        const closure = framebuffer.add_frame_callback((_buffer, event, info) => {
            // Ignore older frames still in flight and discarded frames.
            if (
                this._handoff !== handoff ||
                event !== Cogl.FrameEvent.COMPLETE ||
                info.get_is_symbolic() ||
                info.get_frame_counter() < frameCounter
            )
                return;

            this._cursorViewReady(handoff, view);
        });
        handoff.callbacks.set(view, { framebuffer, closure });
    }

    _cursorViewReady(handoff, view) {
        handoff.views.delete(view);
        if (handoff.views.size > 0) return;

        this._cancelCursorHandoff();
        this._inhibitCursor();
    }

    _cancelCursorHandoff() {
        const handoff = this._handoff;
        this._handoff = null;
        if (!handoff) return;

        if (handoff.paintId) global.stage.disconnect(handoff.paintId);
        for (const { framebuffer, closure } of handoff.callbacks.values()) framebuffer.remove_frame_callback(closure);
    }

    _stopPointerFade() {
        this._destroyPointerActor();
        this._uninhibitCursor();
    }

    _inhibitCursor() {
        if (this._cursorInhibited) return;

        const seat = global.stage.context.get_backend().get_default_seat();

        seat.inhibit_unfocus();
        this._cursorTracker.inhibit_cursor_visibility();

        this._cursorInhibited = true;
    }

    _uninhibitCursor() {
        if (!this._cursorInhibited) return;

        const seat = global.stage.context.get_backend().get_default_seat();

        this._cursorTracker.uninhibit_cursor_visibility();
        seat.uninhibit_unfocus();

        this._cursorInhibited = false;
    }

    _createPointerActor() {
        this._destroyPointerActor();

        if (!this._cursorTracker.get_pointer_visible()) return;

        const sprite = this._cursorTracker.get_sprite();
        if (!sprite) return;

        const [point] = this._cursorTracker.get_pointer();
        const [hotX, hotY] = this._cursorTracker.get_hot();
        const scale = this._cursorTracker.get_scale();

        // Mutter rounds the scaled hotspot before subtracting it from the
        // pointer position. Flooring an unrounded hotspot can move the copy
        // by a pixel, even on an unscaled monitor (cursor scale can differ).
        let x = point.x - Math.round(hotX * scale);
        let y = point.y - Math.round(hotY * scale);

        // Match the pixel alignment used by Mutter's cursor renderer.
        const view = global.stage.peek_stage_views().find((stageView) => {
            const { layout } = stageView;

            return (
                point.x >= layout.x &&
                point.x < layout.x + layout.width &&
                point.y >= layout.y &&
                point.y < layout.y + layout.height
            );
        });

        if (view) {
            const { layout } = view;
            const viewScale = view.get_scale();

            x = layout.x + Math.floor((x - layout.x) * viewScale) / viewScale;
            y = layout.y + Math.floor((y - layout.y) * viewScale) / viewScale;
        }

        // Keep a snapshot so the cursor stays unchanged while fading out.
        const context = sprite.get_context();
        const texture = Cogl.Texture2D.new_with_size(context, sprite.get_width(), sprite.get_height());

        const offscreen = Cogl.Offscreen.new_with_texture(texture);
        offscreen.clear4f(Cogl.BufferBit.COLOR, 0, 0, 0, 0);

        const pipeline = Cogl.Pipeline.new(context);
        pipeline.set_layer_texture(0, sprite);
        // Copy 1:1, scale later when painting the actor.
        pipeline.set_layer_filters(0, Cogl.PipelineFilter.NEAREST, Cogl.PipelineFilter.NEAREST);

        offscreen.draw_textured_rectangle(pipeline, -1, 1, 1, -1, 0, 0, 1, 1);
        // Submit the copy now, before a client can replace the sprite's pixels.
        offscreen.flush();

        this._pointerActor = new Clutter.Actor({
            content: Clutter.TextureContent.new_from_texture(texture, null),
            x,
            y,
            width: sprite.get_width() * scale,
            height: sprite.get_height() * scale,
            reactive: false,
        });

        Main.uiGroup.add_child(this._pointerActor);
        Main.uiGroup.set_child_below_sibling(this._pointerActor, this._lightbox);
    }

    _destroyPointerActor() {
        this._cancelCursorHandoff();
        this._pointerActor?.destroy();
        this._pointerActor = null;
    }
}
