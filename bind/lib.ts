import { Plug } from "../deps.ts";

const VERSION = "0.0.2";
const ENV_VAR = Deno.env.get("FFI_PLUGIN_URL");
const POLICY = ENV_VAR === undefined
  ? Plug.CachePolicy.STORE
  : Plug.CachePolicy.NONE;
const PLUGIN_URL = ENV_VAR ??
  `https://github.com/DjDeveloperr/deno_ffi/releases/download/${VERSION}/`;

await Plug.prepare({
  name: "deno_ffi",
  policy: POLICY,
  url: PLUGIN_URL,
});

const core = (Deno as any).core;

function opSync(name: string, data: any, zeroCopy?: Uint8Array) {
  const res = core.opSync(name, data, zeroCopy);
  if (typeof res !== "object") {
    return res;
  } else {
    if ("err" in res) {
      throw new Error(res.err);
    } else if ("data" in res) {
      return res.data;
    } else return res;
  }
}

export type Type =
  | "u8"
  | "u16"
  | "u32"
  | "u64"
  | "i8"
  | "i16"
  | "i32"
  | "i64"
  | "void"
  | "f32"
  | "f64"
  | "char"
  | "ptr"
  | "raw_ptr"
  | "str";

export interface LibraryMethod {
  params?: Type[];
  returns?: Type | { type: "ptr"; len: number };
}

export interface LibraryMethods {
  [name: string]: LibraryMethod;
}

export class Library {
  #rid: number;

  get rid() {
    return this.#rid;
  }

  constructor(public name: string, public methods: LibraryMethods) {
    this.#rid = opSync("op_dl_open", name);
  }

  call<T = any>(
    name: string | { ptr: number; define: LibraryMethod },
    ...params: any[]
  ): T {
    const method = typeof name === "object" ? name.define : this.methods[name];
    if (!method) throw new Error("Method not defined");
    if (params.length !== (method.params?.length ?? 0)) {
      throw new Error(
        `Expected ${method.params?.length ??
          0} params, but found ${params.length}`,
      );
    }

    const data = {
      rid: this.#rid,
      ptr: typeof name === "object" ? name.ptr : undefined,
      name: typeof name === "object" ? "" : name,
      params: (params ?? []).map((e, i) => {
        let type = method.params![i];
        if (type === "char") {
          if (typeof e === "number") {
          } else if (typeof e === "string") {
            if (e.length !== 1) {
              throw new Error(
                "Expected char to be of 1 byte, but got " +
                  e.length +
                  " instead",
              );
            }
            e = e.charCodeAt(0);
          }
          type = "u8";
        }

        return {
          ptype: type,
          value: e,
        };
      }),
      rtype: typeof method.returns === "string"
        ? method.returns
        : typeof method.returns === "undefined"
        ? "void"
        : method.returns.type,
      rlen: typeof method.returns === "object" ? method.returns.len : undefined,
    };

    let res = opSync("op_dl_call", JSON.stringify(data));
    if (data.rtype === "raw_ptr") res = parseInt(res, 16);
    if (data.rtype === "ptr") res = new Uint8Array(res);
    return res;
  }

  close() {
    opSync("op_dl_close", this.#rid);
  }
}

export function readPointer(addr: number, len: number): Uint8Array {
  return new Uint8Array(opSync("op_dl_ptr_read", {
    addr,
    len,
  }));
}
