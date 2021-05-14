const core = (Deno as any).core;

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
    this.#rid = core.opSync("op_dl_open", name);
  }

  call(
    name: string | { ptr: number; define: LibraryMethod },
    ...params: any[]
  ) {
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

    let res = core.opSync("op_dl_call", JSON.stringify(data));
    if (data.rtype === "raw_ptr") res = parseInt(res, 16);
    return res;
  }

  close() {
    core.opSync("op_dl_close", this.#rid);
  }
}

export function readPointer(addr: number, len: number): Uint8Array {
  return new Uint8Array(core.opSync("op_dl_ptr_read", {
    addr,
    len,
  }));
}
