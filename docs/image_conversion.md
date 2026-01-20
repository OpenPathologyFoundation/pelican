# Image Conversion

The `large_image` library can read a variety of images with the various
tile source modules. Some image files that cannot be read directly can
be converted into a format that can be read by the `large_image`
library. Additionally, some images that can be read are very slow to
handle because they are stored inefficiently, and converting them will
make a equivalent file that is more efficient.

## Python Usage

The `large_image_converter` module can be used as a Python package. See
`_build/large_image_converter/modules`{.interpreted-text role="doc"} for
details.

## Command Line Usage

Installing the `large-image-converter` module adds a
`large_image_converter` command to the local environment. Running
`large_image_converter --help` displays the various options.

``` {literal=""}
```
