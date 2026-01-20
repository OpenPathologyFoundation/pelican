# Developer Guide

## Developer Installation

To install all packages from source, clone the repository:

    git clone https://github.com/girder/large_image.git
    cd large_image

Install all packages and dependencies:

    pip install -e . -r requirements-dev.txt

### Tile Source Requirements

Many tile sources have complex prerequisites. These can be installed
directly using your system\'s package manager or from some prebuilt
Python wheels for Linux. The prebuilt wheels are not official packages,
but they can be used by instructing pip to use them by preference:

    pip install -e . -r requirements-dev.txt --find-links https://girder.github.io/large_image_wheels

### Test Requirements

Besides an appropriate version of Python, Large Image tests are run via
[tox](https://tox.readthedocs.io/en/latest/). This is also a convenient
way to setup a development environment.

The `tox` Python package must be installed:

``` bash
pip install tox
```

See the tox documentation for how to recreate test environments or
perform other maintenance tasks.

By default, instead of storing test environments in a `.tox` directory,
they are stored in the `build/tox` directory.

## Running Tests

Tests are run via tox environments:

``` bash
tox -e core-py39,lint
```

You can build the docs. They are created in the `docs/build` directory:

``` bash
tox -e docs
```

You can run specific tests using pytest\'s options, e.g., to try one
specific test:

``` bash
tox -e core-py39 -- -k testFromTiffRGBJPEG
```

## Development Environment

To set up a development environment, you can use tox. This is not
required to run tests. The `core` environment will also install pytest
and other tools needed for testing.

For OSX users, specify the `core-osx` environment instead; it will
install only the cross-platform common sources.

You can add a suffix to the environment to get a specific version of
python (e.g., `core-py311` or `core-osx-py310`).

``` bash
tox --devenv /my/env/path -e core
```

and then switch to that environment:

``` bash
. /my/env/path/bin/activate
```
