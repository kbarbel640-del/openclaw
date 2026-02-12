# Memory

## Operational Notes

- **Tool Usage**: When using `read` with `offset`, ensure the offset is within the file's bounds. If a read fails with "Offset X is beyond end of file", retry without an offset or with a smaller offset to get the correct content.
