# Application Data Directory

The per-user application data directory is located in the following directory:

- `%APPDATA%\mdcomment` on Windows
- `$XDG_CONFIG_HOME/mdcomment` or `~/.config/mdcomment` on Linux
- `~/Library/Application Support/mdcomment` on macOS

When [portable mode](PORTABLE.md) is enabled, the directory location is either the `--user-data-dir` parameter or `mdcomment-user-data` directory.
