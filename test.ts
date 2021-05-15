import { Library } from "./mod.ts";

const lib = new Library(
  "./testdata/ClassLibrary.dll",
  {
    libnative_symbols: {
      returns: "raw_ptr",
    },
  },
);

console.log(lib.call("write_line", 60, 9));
