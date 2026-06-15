DIST ?= 0.1
NAME = cockpit-nvidia

.PHONY: all install dist clean debug

all:

install:
	@echo "Installing $(NAME)-v$(DIST) to /usr/share/cockpit/cockpit-nvidia/"
	sudo cp -a manifest.json index.html index.js index.css "$(DESTDIR)/usr/share/cockpit/cockpit-nvidia/"
	sudo cp "$(DESTDIR)"/usr/share/cockpit/cockpit-nvidia/org.cockpit_project.nvidia_read.policy \
		"$(DESTDIR)"/usr/share/polkit-1/actions/ || :
	sudo cp -a org.cockpit_project.nvidia_read.policy \
		/usr/share/polkit-1/actions/ 2>/dev/null || echo "Copy polkit policy to /usr/share/polkit-1/actions/"
	sudo systemctl restart cockpit.socket

dist:
	rm -rf $(NAME)-$(DIST)
	mkdir -p $(NAME)-$(DIST)
	cp manifest.json index.html index.js index.css org.cockpit_project.nvidia_read.policy README.adoc CHANGES.md \
		$(NAME)-$(DIST)/
	tar cfJ $(NAME)-$(DIST).tar.xz $(NAME)-$(DIST)
	rm -rf $(NAME)-$(DIST)
	@echo "Created $(NAME)-$(DIST).tar.xz"

clean:
	rm -f $(NAME)-*.tar.xz

debug:
	@echo "To test locally, run:"
	@echo "  sudo cp -a manifest.json index.html index.js index.css /usr/share/cockpit/cockpit-nvidia/"
	@echo "  sudo systemctl restart cockpit.socket"
	@echo "  Open https://localhost:9090 and click 'NVIDIA GPU'"

build-rpm: dist
	rpmbuild -tb $(NAME)-$(DIST).tar.xz
	sudo dnf localinstall /root/rpmbuild/RPMS/noarch/$(NAME)-*.rpm
