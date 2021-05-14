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

  call(name: string, ...params: any[]) {
    const method = this.methods[name];
    if (!method) throw new Error("Method not defined");
    if (params.length !== (method.params?.length ?? 0)) {
      throw new Error(
        `Expected ${method.params?.length ??
          0} params, but found ${params.length}`,
      );
    }

    const data = {
      rid: this.#rid,
      name,
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

    return core.opSync("op_dl_call", JSON.stringify(data));
  }

  close() {
    core.opSync("op_dl_close", this.#rid);
  }
}
