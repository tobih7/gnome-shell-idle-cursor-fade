UUID = hide-cursor-idle-fade@tobi
ZIP = build/$(UUID).shell-extension.zip

.PHONY: build install clean

build:
	mkdir -p build
	gnome-extensions pack --force --out-dir=build .

install: build
	gnome-extensions install --force $(ZIP)

clean:
	rm -rf build
