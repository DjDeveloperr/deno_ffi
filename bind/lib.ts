import { cache, Plug } from "../deps.ts";
import { name, version } from "../meta.ts";

const VERSION = version;
const ENV_VAR = Deno.env.get("FFI_PLUGIN_URL");
const POLICY = ENV_VAR === undefined
  ? Plug.CachePolicy.STORE
  : Plug.CachePolicy.NONE;
const PLUGIN_URL = ENV_VAR ??
  `https://github.com/DjDeveloperr/deno_ffi/releases/download/${VERSION}/`;

await Plug.prepare({
  name,
  policy: POLICY,
  url: PLUGIN_URL,
});

export enum CachePolicy {
  NONE,
  STORE,
}

export interface PrepareOptionsBase {
  policy: CachePolicy;
}

export type OS = "darwin" | "linux" | "windows";

export interface PrepareOptionsURL extends PrepareOptionsBase {
  name: string;
  prefix?: boolean;
  url: string;
}

export interface PrepareOptionsURLS extends PrepareOptionsBase {
  urls: { [name in OS]: string | undefined };
}

export type PrepareOptions = PrepareOptionsURL | PrepareOptionsURLS;

const extensions: {
  [name in OS]: string;
} = {
  darwin: "dylib",
  windows: "dll",
  linux: "so",
};

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

/**
 * Represents a Dynamic Library.
 *
 * When being constructed, makes op call to create Library resource.
 */
export class Library {
  #rid: number;

  get rid() {
    return this.#rid;
  }

  constructor(public name: string, public methods: LibraryMethods) {
    this.#rid = opSync("op_dl_open", name);
  }

  /**
   * Calls a FFI method. You can either use method name (it should be defined in Library.methods) or a pointer address along with definition.
   *
   * ```ts
   * lib.call("method", ...args);
   *
   * // For example
   *
   * lib.call("add", 1, 2);
   *
   * // Using pointers
   *
   * lib.call({
   *   ptr: number,
   *   define: { params: ["i32", "i32"], returns: "i32" },
   * }, 1, 2);
   * ```
   *
   * @param name Name of the method (symbol) or a object containing pointer address and method definition (useful for structs that return pointers to further functions)
   * @param params Params to call method with
   * @returns Value returned from FFI call
   */
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

  /** Closes the Dy Library resource (no longer usable after this) */
  close() {
    opSync("op_dl_close", this.#rid);
  }

  /**
   * Automatically caches the library (either from URL or local path)
   *
   * ```ts
   * const lib = await Library.prepare({
   *   urls: {
   *     windows: "path/to/name.dll",
   *     darwin: "path/to/libname.dylib",
   *     linux: "path/to/libname.so",
   *   },
   * });
   *
   * // or alternatively,
   *
   * const lib = await Library.prepare({
   *   name: "name",
   *   url: "path/to",
   * });
   * ```
   *
   * @param options Options for caching
   * @param define Method definitions
   * @returns The Library object
   */
  static async prepare(
    options: PrepareOptions,
    define: LibraryMethods,
  ): Promise<Library> {
    const url = "url" in options
      ? `${options.url}/${
        options.prefix !== false
          ? (Deno.build.os === "windows" ? "" : "lib")
          : ""
      }${options.name}.${extensions[Deno.build.os]}`
      : options.urls[Deno.build.os];
    if (!url) {
      throw new Error(`URL not found to load Library for OS: ${Deno.build.os}`);
    }
    const file = await cache(
      url,
      options.policy as any,
      "dylibs",
    );
    const lib = new Library(file.path, define);
    return lib;
  }
}

/** Read pointer using its address and a size */
export function readPointer(addr: number, len: number): Uint8Array {
  return new Uint8Array(opSync("op_dl_ptr_read", {
    addr,
    len,
  }));
}
