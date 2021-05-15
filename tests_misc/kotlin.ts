import { Library } from "../mod.ts";

const lib = new Library(
  new URL("../testdata/libnative.dll", import.meta.url).toString().slice(
    "file:///".length,
  ),
  {
    libnative_symbols: {
      returns: {
        type: "ptr",
        len: 13 * 8,
      },
    },
  },
);

const val = new Uint8Array(lib.call("libnative_symbols"));
const view = new DataView(val.buffer);
const fnptr = Number(view.getBigUint64(12 * 8, true));

console.log(
  lib.call({
    ptr: fnptr,
    define: {
      params: ["str"],
      returns: "str",
    },
  }, "Hello"),
);
