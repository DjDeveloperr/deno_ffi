use std::{borrow::Cow, io::Write};
use std::{cell::RefCell, ffi::CStr};

use deno_core::error::bad_resource_id;
use deno_core::serde::Deserialize;
use deno_core::Extension;
use deno_core::OpState;
use deno_core::Resource;
use deno_core::ResourceId;
use deno_core::ZeroCopyBuf;
use deno_core::{error::AnyError, serde_json::Value};
use deno_core::{op_sync, serde_json::json};

use dlopen::raw::Library;
use libc::{c_char, c_void};
use libffi::high::{arg, call, Arg, CodePtr};
use std::ffi::CString;

struct LibraryResource(RefCell<Library>);

impl Resource for LibraryResource {
    fn name(&self) -> Cow<str> {
        "library".into()
    }
}

#[no_mangle]
pub fn init() -> Extension {
    Extension::builder()
        .ops(vec![
            ("op_dl_open", op_sync(op_dl_open)),
            ("op_dl_close", op_sync(op_dl_close)),
            ("op_dl_call", op_sync(op_dl_call)),
            ("op_dl_ptr_read", op_sync(op_dl_ptr_read)),
        ])
        .build()
}

fn op_dl_open(
    state: &mut OpState,
    name: String,
    _zero_copy: Option<ZeroCopyBuf>,
) -> Result<ResourceId, AnyError> {
    let lib = Library::open(name)?;
    let res = LibraryResource(RefCell::new(lib));

    Ok(state.resource_table.add(res))
}

fn op_dl_close(
    state: &mut OpState,
    rid: ResourceId,
    _zero_copy: Option<ZeroCopyBuf>,
) -> Result<(), AnyError> {
    state
        .resource_table
        .close(rid)
        .ok_or_else(bad_resource_id)?;
    Ok(())
}

#[derive(Deserialize)]
struct DlCallParam {
    pub ptype: String,
    pub value: Value,
}

#[derive(Deserialize)]
struct DlCallArgs {
    pub rid: ResourceId,
    pub ptr: Option<u64>,
    pub name: String,
    pub params: Vec<DlCallParam>,
    pub rtype: String,
    pub rlen: Option<usize>,
}

enum ArgType {
    Void,
    U8(u8),
    I8(i8),
    U16(u16),
    I16(i16),
    U32(u32),
    I32(i32),
    I64(i64),
    U64(u64),
    F32(f32),
    F64(f64),
    String(*mut i8),
    Pointer(*mut u8),
}

fn op_dl_call(
    state: &mut OpState,
    options: String,
    _zero_copy: Option<ZeroCopyBuf>,
) -> Result<Value, AnyError> {
    let options: DlCallArgs = deno_core::serde_json::from_str(&options).unwrap();

    let lib_res = state
        .resource_table
        .get::<LibraryResource>(options.rid)
        .ok_or_else(bad_resource_id)?;

    let lib = lib_res.0.borrow_mut();

    let fn_ptr = {
        if options.ptr.is_some() {
            options.ptr.unwrap() as *const c_void
        } else {
            unsafe { lib.symbol(&options.name)? }
        }
    };
    let code_ptr = CodePtr::from_ptr(fn_ptr);

    let mut vecs = vec![];

    let cargs: Vec<ArgType> = options
        .params
        .iter()
        .map(|param| match param.ptype.as_str() {
            "u8" => ArgType::U8(param.value.as_u64().unwrap() as u8),
            "u16" => ArgType::U16(param.value.as_u64().unwrap() as u16),
            "u32" => ArgType::U32(param.value.as_u64().unwrap() as u32),
            "u64" => ArgType::U64(param.value.as_u64().unwrap()),
            "i8" => ArgType::I8(param.value.as_i64().unwrap() as i8),
            "i16" => ArgType::I16(param.value.as_i64().unwrap() as i16),
            "i32" => ArgType::I32(param.value.as_i64().unwrap() as i32),
            "i64" => ArgType::I64(param.value.as_str().unwrap().parse::<i64>().unwrap()),
            "f32" => ArgType::F32(param.value.as_f64().unwrap() as f32),
            "f64" => ArgType::F64(param.value.as_f64().unwrap()),
            "ptr" => {
                let arr = param.value.as_array().unwrap();
                let mut v = vec![];
                for e in arr {
                    v.push(e.as_i64().unwrap() as u8);
                }
                let len = vecs.len();
                vecs.push(v);
                let v = vecs.get_mut(len).unwrap();
                let ptr = v.as_mut_slice().as_mut_ptr();
                ArgType::Pointer(ptr)
            }
            "str" => ArgType::String(
                CString::new(param.value.as_str().unwrap())
                    .unwrap()
                    .into_raw(),
            ),
            _ => ArgType::Void,
        })
        .collect();

    let args: Vec<Arg> = cargs
        .iter()
        .map(|value| match value {
            ArgType::Void => arg(&()),
            ArgType::I8(v) => arg(v),
            ArgType::I16(v) => arg(v),
            ArgType::I32(v) => arg(v),
            ArgType::I64(v) => arg(v),
            ArgType::U8(v) => arg(v),
            ArgType::U16(v) => arg(v),
            ArgType::U32(v) => arg(v),
            ArgType::U64(v) => arg(v),
            ArgType::F32(v) => arg(v),
            ArgType::F64(v) => arg(v),
            ArgType::String(val) => arg(val),
            ArgType::Pointer(val) => arg(val),
        })
        .collect();

    let result = unsafe {
        match options.rtype.as_str() {
            "void" => json!(call::<()>(code_ptr, args.as_slice())),
            "i8" => json!(call::<i8>(code_ptr, args.as_slice())),
            "i16" => json!(call::<i16>(code_ptr, args.as_slice())),
            "i32" => json!(call::<i32>(code_ptr, args.as_slice())),
            "u8" => json!(call::<u8>(code_ptr, args.as_slice())),
            "u16" => json!(call::<u16>(code_ptr, args.as_slice())),
            "u32" => json!(call::<u32>(code_ptr, args.as_slice())),
            "i64" => json!(call::<i64>(code_ptr, args.as_slice()).to_string()),
            "u64" => json!(call::<u64>(code_ptr, args.as_slice()).to_string()),
            "f32" => json!(call::<f32>(code_ptr, args.as_slice())),
            "f64" => json!(call::<f64>(code_ptr, args.as_slice())),
            "ptr" => {
                let ptr = call::<*mut u8>(code_ptr, args.as_slice());
                let mut v: Vec<u8> = Vec::new();
                let slice = std::slice::from_raw_parts(ptr, options.rlen.unwrap());
                v.write(slice).unwrap();
                json!(v)
            }
            "raw_ptr" => {
                let ptr = call::<*const u8>(code_ptr, args.as_slice());
                json!(format!("{:?}", ptr))
            }
            "str" => {
                let ptr = call::<*const c_char>(code_ptr, args.as_slice());
                let cstr = CStr::from_ptr(ptr);
                let res = cstr.to_str().unwrap().to_string();
                json!(res)
            }
            _ => json!(null),
        }
    };

    Ok(result)
}

#[derive(Deserialize)]
struct PtrReadArgs {
    pub addr: u64,
    pub len: usize,
}

fn op_dl_ptr_read(
    _state: &mut OpState,
    options: PtrReadArgs,
    _zero_copy: Option<ZeroCopyBuf>,
) -> Result<Value, AnyError> {
    let ptr = options.addr as *const u8;
    let mut v: Vec<u8> = Vec::new();
    let slice = unsafe { std::slice::from_raw_parts(ptr, options.len) };
    v.write(slice).unwrap();
    Ok(json!(v))
}
