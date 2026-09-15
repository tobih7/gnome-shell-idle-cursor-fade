UUID = idle-cursor-fade@tobih7
ZIP = build/$(UUID).shell-extension.zip

.PHONY: build install test clean

build:
	mkdir -p build
	gnome-extensions pack --extra-source=LICENSE --force --out-dir=build .

install: build
	gnome-extensions install --force $(ZIP)

clean:
	rm -rf build
