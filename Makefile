.PHONY: all test build install-hooks

all: test build

test:
	npm test

build:
	npm run build

install-hooks:
	git config core.hooksPath .githooks
