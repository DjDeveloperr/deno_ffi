import { Library } from "./mod.ts";

const lib = new Library("./test_lib/target/debug/test_lib.dll", {
  add: {
    params: ["i32", "i32"],
    returns: "i32",
  },
  hello: {
    params: ["str"],
    returns: "str",
  },
});

console.log(lib.call("add", 1, 2));
console.log(lib.call("hello", "World"));
