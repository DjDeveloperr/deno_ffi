import { Library } from "../mod.ts";

const lib = new Library(
  new URL("../testdata/NativeLibTest.dll", import.meta.url).toString().slice(
    "file:///".length,
  ),
  {
    add_int: {
      params: ["i32", "i32"],
      returns: "i32",
    },
  },
);

console.log(lib.call("add_int", 60, 9));
