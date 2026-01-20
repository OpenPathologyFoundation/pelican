# Configuration Options

Some functionality of large_image is controlled through configuration
parameters. These can be read or set via python using functions in the
`large_image.config` module,
[getConfig](./_build/large_image/large_image.html#large_image.config.getConfig)
and
[setConfig](./_build/large_image/large_image.html#large_image.config.setConfig).

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Key(s)                                                            Description                           Type                                                       Default
  ----------------------------------------------------------------- ------------------------------------- ---------------------------------------------------------- -----------------------------------------------
  `logger` `🔗 <config_logger>`{.interpreted-text role="ref"}       Most log messages are sent here.      `logging.Logger`                                           This defaults to the standard python logger
                                                                                                                                                                     using the name large_image.

  `logprint` `🔗 <config_logprint>`{.interpreted-text role="ref"}   Messages about available tilesources  `logging.Logger`                                           This defaults to the standard python logger
                                                                    are sent here.                                                                                   using the name large_image.

  `default_encoding`                                                Default encoding for tile sources.    `'JPEG' | 'PNG' | 'TIFF' | 'TILED'`                        `None`
  `🔗 <config_default_encoding>`{.interpreted-text role="ref"}                                                                                                       

  `default_projection`                                              Default projection for geospatial     `str | None`                                               `None`
  `🔗 <config_default_projection>`{.interpreted-text role="ref"}    tile sources. Use a proj4 projection                                                             
                                                                    string or a case-insensitive string                                                              
                                                                    of the form \'EPSG:\<epsg number\>\'.                                                            

  `cache_backend` `🔗 <config_cache_backend>`{.interpreted-text     String specifying how tiles are       `None | str: "python" | str: "memcached" | str: "redis"`   `None` (When None, the first cache available in
  role="ref"}                                                       cached. If memcached is not available                                                            the order memcached, redis, python is used.
                                                                    for any reason, the python cache is                                                              Otherwise, the specified cache is used if
                                                                    used instead.                                                                                    available, falling back to python if not.)

  `cache_python_memory_portion`                                     If tiles are cached with python, the  `int`                                                      `16`
  `🔗 <config_cache_python_memory_portion>`{.interpreted-text       cache is sized so that it is expected                                                            
  role="ref"}                                                       to use less than 1 /                                                                             
                                                                    (`cache_python_memory_portion`) of                                                               
                                                                    the available memory.                                                                            

  `cache_memcached_url`                                             If tiles are cached in memcached, the `str | List[str]`                                          `"127.0.0.1"`
  `🔗 <config_cache_memcached_url>`{.interpreted-text role="ref"}   url or list of urls where the                                                                    
                                                                    memcached server is located.                                                                     

  `cache_memcached_username`                                        A username for the memcached server.  `str`                                                      `None`
  `🔗 <config_cache_memcached_username>`{.interpreted-text                                                                                                           
  role="ref"}                                                                                                                                                        

  `cache_memcached_password`                                        A password for the memcached server.  `str`                                                      `None`
  `🔗 <config_cache_memcached_password>`{.interpreted-text                                                                                                           
  role="ref"}                                                                                                                                                        

  `cache_redis_url` `🔗 <config_cache_redis_url>`{.interpreted-text If tiles are cached in redis, the url `str | List[str]`                                          `"127.0.0.1:6379"`
  role="ref"}                                                       or list of urls where the redis                                                                  
                                                                    server is located.                                                                               

  `cache_redis_username`                                            A username for the redis server.      `str`                                                      `None`
  `🔗 <config_cache_redis_username>`{.interpreted-text role="ref"}                                                                                                   

  `cache_redis_password`                                            A password for the redis server.      `str`                                                      `None`
  `🔗 <config_cache_redis_password>`{.interpreted-text role="ref"}                                                                                                   

  `cache_tilesource_memory_portion`                                 Tilesources are cached on open so     `int`                                                      `32` Memory usage by tile source is necessarily
  `🔗 <config_cache_tilesource_memory_portion>`{.interpreted-text   that subsequent accesses can be                                                                  a rough estimate, since it can vary due to a
  role="ref"}                                                       faster. These use file handles and                                                               wide variety of image-specific and
                                                                    memory. This limits the maximum based                                                            deployment-specific details; this is intended
                                                                    on a memory estimation and using no                                                              to be conservative.
                                                                    more than 1 /                                                                                    
                                                                    (`cache_tilesource_memory_portion`)                                                              
                                                                    of the available memory.                                                                         

  `cache_tilesource_maximum`                                        If this is zero, this signifies that  `int`                                                      `0`
  `🔗 <config_cache_tilesource_maximum>`{.interpreted-text          `cache_tilesource_memory_portion`                                                                
  role="ref"}                                                       determines the number of sources that                                                            
                                                                    will be cached. If this greater than                                                             
                                                                    0, the cache will be the smaller of                                                              
                                                                    the value computed for the memory                                                                
                                                                    portion and this value (but always at                                                            
                                                                    least 3).                                                                                        

  `cache_sources` `🔗 <config_cache_sources>`{.interpreted-text     If set to False, the default will be  `bool`                                                     `True`
  role="ref"}                                                       to not cache tile sources. This has                                                              
                                                                    substantial performance penalties if                                                             
                                                                    sources are used multiple times, so                                                              
                                                                    should only be set in singular                                                                   
                                                                    dynamic environments such as                                                                     
                                                                    experimental notebooks.                                                                          

  `max_small_image_size`                                            The PIL tilesource is used for small  `int`                                                      `4096` Specifying values greater than this
  `🔗 <config_max_small_image_size>`{.interpreted-text role="ref"}  images if they are no more than this                                                             could reduce compatibility with tile use on
                                                                    many pixels along their maximum                                                                  some browsers. In general, `8192` is safe for
                                                                    dimension.                                                                                       all modern systems, and values greater than
                                                                                                                                                                     `16384` should not be specified if the image
                                                                                                                                                                     will be viewed in any browser.

  `source_bioformats_ignored_names`, `source_pil_ignored_names`,    Some tile sources can read some files `str` (regular expression)                                 Sources have different default values; see each
  `source_vips_ignored_names`                                       that are better read by other                                                                    source for its default. For example, the vips
  `🔗 <config_source_ignored_names>`{.interpreted-text role="ref"}  tilesources. Since reading these                                                                 source default is
                                                                    files is suboptimal, these tile                                                                  `r'(^[^.]*|\.(yml|yaml|json|png|svs|mrxs))$'`
                                                                    sources have a setting that, by                                                                  
                                                                    default, ignores files without                                                                   
                                                                    extensions or with particular                                                                    
                                                                    extensions.                                                                                      

  `all_sources_ignored_names`                                       If a file matches the regular         `str` (regular expression)                                 `'(\.mrxs|\.vsi)$'`
  `🔗 <config_all_sources_ignored_names>`{.interpreted-text         expression in this setting, it will                                                              
  role="ref"}                                                       only be opened by sources that                                                                   
                                                                    explicitly match the extension or                                                                
                                                                    mimetype. Some formats are composed                                                              
                                                                    of multiple files that can be read as                                                            
                                                                    either a small image or as a large                                                               
                                                                    image depending on the source; this                                                              
                                                                    prohibits all sources that don\'t                                                                
                                                                    explicitly support the format.                                                                   

  `icc_correction` `🔗 <config_icc_correction>`{.interpreted-text   If this is True or undefined, ICC     `bool | str: one of PIL.ImageCms.Intents`                  `True`
  role="ref"}                                                       color correction will be applied for                                                             
                                                                    tile sources that have ICC profile                                                               
                                                                    information. If False, correction                                                                
                                                                    will not be applied. If the style                                                                
                                                                    used to open a tilesource specifies                                                              
                                                                    ICC correction explicitly (on or                                                                 
                                                                    off), then this setting is not used.                                                             
                                                                    This may also be a string with one of                                                            
                                                                    the intents defined by the                                                                       
                                                                    PIL.ImageCms.Intents enum. `True` is                                                             
                                                                    the same as `perceptual`.                                                                        
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  : Configuration Parameters

## Configuration from Python

As an example, configuration parameters can be set via python code like:

    import large_image

    large_image.config.setConfig('max_small_image_size', 8192)

If reading many different images but never revisiting them, it can be
useful to reduce caching to a minimum. There is a utility function to
make this easier:

    large_image.config.minimizeCaching()

## Configuration from Environment

All configuration parameters can be specified as environment parameters
by prefixing their uppercase names with `LARGE_IMAGE_`. For instance,
`LARGE_IMAGE_CACHE_BACKEND=python` specifies the cache backend. If the
values can be decoded as json, they will be parsed as such. That is,
numerical values will be parsed as numbers; to parse them as strings,
surround them with double quotes.

As another example, to use the least memory possible, set
`LARGE_IMAGE_CACHE_BACKEND=python LARGE_IMAGE_CACHE_PYTHON_MEMORY_PORTION=1000 LARGE_IMAGE_CACHE_TILESOURCE_MAXIMUM=2`.
The first setting specifies caching tiles in the main process and not in
memcached or an external cache. The second setting asks to use 1/1000th
of the memory for a tile cache. The third settings caches no more than 2
tile sources (2 is the minimum).

## Logging from Python

The log levels can be adjusted in the standard Python manner:

    import logging
    import large_image

    logger = logging.getLogger('large_image')
    logger.setLevel(logging.CRITICAL)

Alternately, a different logger can be specified via `setConfig` in the
`logger` and `logprint` settings:

    import logging
    import large_image

    logger = logging.getLogger(__name__)
    large_image.config.setConfig('logger', logger)
    large_image.config.setConfig('logprint', logger)
