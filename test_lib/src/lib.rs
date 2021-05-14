use libc::c_char;
use std::ffi::{CStr, CString};

#[no_mangle]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[repr(C)]
#[derive(Debug)]
pub struct TestStruct {
    val1: i32,
    val2: u32,
}

#[no_mangle]
pub fn test_struct(ptr: *mut u8) {
    let v: &mut TestStruct = unsafe { (ptr as *mut TestStruct).as_mut().unwrap() };
    println!("struct {:?}", v);
}

#[no_mangle]
pub fn hello(name: *const c_char) -> *const c_char {
    let cstr = unsafe { CStr::from_ptr(name) };
    let name = cstr.to_str().unwrap();
    let string = CString::new(format!("Hello, {}", name)).unwrap();
    string.into_raw()
}
