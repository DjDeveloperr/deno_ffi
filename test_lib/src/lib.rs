use libc::c_char;
use std::ffi::CString;
use std::io::Write;

#[no_mangle]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[no_mangle]
pub fn hello(name: *mut c_char) -> *const c_char {
    // println!("ptr {:?}", name);
    // let mut v: Vec<u8> = Vec::new();
    // let slice = unsafe { std::slice::from_raw_parts_mut(name as *mut u8, 6) }; 
    // v.write(slice).unwrap();
    // println!("val {:?}", v);
    let cstr = unsafe { CString::from_raw(name) };
    let name = cstr.to_str().unwrap();
    let string = CString::new(format!("Hello, {}", name)).unwrap();
    string.into_raw()
}
