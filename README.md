# Archived: Deno has built-in FFI now and plugins are removed.

# Deno FFI

Plugin to call dynamic library functions in Deno.

## Usage

```ts
import { Library } from "https://deno.land/x/deno_ffi@0.0.5/mod.ts";

const lib = new Library("path/to/file.(so|dll|dylib)", {
  add: {
    params: ["i32", "i32"],
    returns: "i32",
  },
});

console.log("add", lib.call("add", 1, 2));
```

## License

Check [LICENSE](./LICENSE) for more info.

Copyright 2021 @ DjDeveloperr
