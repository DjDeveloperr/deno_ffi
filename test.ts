import { Library, readPointer } from "./mod.ts";

const lib = new Library(
  "./libnative.dll" || "./test_lib/target/debug/test_lib.dll",
  {
    add: {
      params: ["i32", "i32"],
      returns: "i32",
    },
    test_struct: {
      params: ["ptr"],
    },
    "libnative_ExportedSymbols::kotlin::root::hello": {
      params: ["str"],
      returns: "str",
    },
    libnative_symbols: {
      returns: "raw_ptr",
    },
  },
);

// console.log("add", lib.call("add", 1, 2));

// const buf = new Uint8Array(8);
// const view = new DataView(buf.buffer);
// view.setInt32(0, 69, true);
// view.setUint32(4, 96, true);
// console.log("test_struct", lib.call("test_struct", [...buf]));

// console.log(
//   "hello",
//   lib.call("hello", [...new TextEncoder().encode("World"), 0]),
// );

// console.log(
//   "hello",
//   lib.call("libnative_ExportedSymbols::kotlin::root::hello", "World"),
// );

const ptr = lib.call("libnative_symbols");
console.log("ptr", ptr);
const val = readPointer(ptr, 13 * 8);
console.log("val", val);
const view = new DataView(val.buffer);
const fnptr = Number(view.getBigUint64(12 * 8, true));
console.log("fnptr", fnptr);
console.log(
  lib.call({
    ptr: fnptr,
    define: {
      params: ["str"],
      returns: "str",
    },
  }, "Hello"),
);
