use libc::c_char;
use std::ffi::CString;

#[no_mangle]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[no_mangle]
pub unsafe fn hello(name: *mut c_char) -> *const c_char {
    let cstr = CString::from_raw(name);
    let name = cstr.to_str().unwrap();
    let string = CString::new(format!("Hello, {}", name)).unwrap();
    string.into_raw()
}
