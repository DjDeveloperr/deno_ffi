import { Library } from "../mod.ts";

const lib = new Library(
  new URL("./target/debug/test_lib.dll", import.meta.url).toString().slice(
    "file:///".length,
  ),
  {
    add: {
      params: ["i32", "i32"],
      returns: "i32",
    },
    test_struct: {
      params: ["ptr"],
    },
    hello: {
      params: ["str"],
      returns: "str",
    },
  },
);

console.log("add:", lib.call("add", 1, 2));

const buf = new Uint8Array(8);
const view = new DataView(buf.buffer);
view.setInt32(0, 69, true);
view.setUint32(4, 96, true);
lib.call("test_struct", [...buf]);

console.log(
  "hello:",
  lib.call("hello", "World"),
);
