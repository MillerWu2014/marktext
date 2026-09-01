# Command Line Interface

```
Usage: mdcomment [commands] [path ...]

  Available commands:

        --debug                   Enable debug mode
        --safe                    Disable plugins and other user configuration
    -n, --new-window              Open a new window on second-instance
        --user-data-dir           Change the user data directory
        --disable-gpu             Disable GPU hardware acceleration
        --disable-spellcheck      Disable the spell checker for this session
    -v, --verbose                 Be verbose
        --version                 Print version information
    -h, --help                    Print this help message
```

`mdcomment` should point to your installation of MDComment. The exact location will vary from platform to platform. On macOS, you can create a convenient alias like:

```sh
alias mdcomment="/Applications/MDComment.app/Contents/MacOS/MDComment"
```
