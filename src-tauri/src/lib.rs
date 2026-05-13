use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
#[cfg(target_os = "macos")]
use std::sync::Arc;
use tauri::Emitter;
use tauri::Manager;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

// =============================================================================
// i18n for tray menu
// =============================================================================

#[derive(Clone, Copy, PartialEq)]
enum Lang {
    Zh,
    En,
}

struct TrayLang(Mutex<Lang>);

struct TrayLabels {
    show_visible: &'static str,
    show_hidden: &'static str,
    pin_on: &'static str,
    pin_off: &'static str,
    view_farm: &'static str,
    view_flat: &'static str,
    view_heatmap: &'static str,
    persp_left: &'static str,
    persp_right: &'static str,
    settings: &'static str,
    stats: &'static str,
    quit: &'static str,
    lang_switch: &'static str,
}

const ZH_LABELS: TrayLabels = TrayLabels {
    show_visible: "隐藏窗口",
    show_hidden: "显示窗口",
    pin_on: "取消置顶",
    pin_off: "置顶窗口",
    view_farm: "农场",
    view_flat: "平面",
    view_heatmap: "热力图",
    persp_left: "左",
    persp_right: "右",
    settings: "设置",
    stats: "统计",
    quit: "退出",
    lang_switch: "English",
};

const EN_LABELS: TrayLabels = TrayLabels {
    show_visible: "Hide Window",
    show_hidden: "Show Window",
    pin_on: "Unpin from Top",
    pin_off: "Pin to Top",
    view_farm: "Farm",
    view_flat: "Flat",
    view_heatmap: "Heatmap",
    persp_left: "Left",
    persp_right: "Right",
    settings: "Settings",
    stats: "Stats",
    quit: "Quit",
    lang_switch: "中文",
};

fn get_labels(lang: Lang) -> &'static TrayLabels {
    match lang {
        Lang::Zh => &ZH_LABELS,
        Lang::En => &EN_LABELS,
    }
}

struct TrayMenuItems {
    show: MenuItem<tauri::Wry>,
    pin: MenuItem<tauri::Wry>,
    heatmap: MenuItem<tauri::Wry>,
    perspective: MenuItem<tauri::Wry>,
    settings: MenuItem<tauri::Wry>,
    stats: MenuItem<tauri::Wry>,
    quit: MenuItem<tauri::Wry>,
    lang: MenuItem<tauri::Wry>,
}

struct WindowVisible(AtomicBool);
struct WindowPinned(AtomicBool);
struct ViewModeState(std::sync::atomic::AtomicU8);   // 0=farm, 1=flat, 2=heatmap
struct PerspectiveIdx(std::sync::atomic::AtomicU8);  // 0=left, 1=right
struct ListenerStarted(AtomicBool);

#[derive(Clone, Serialize)]
struct KeyPressEvent {
    key_code: String,
}

// =============================================================================
// macOS keyboard listener (CoreGraphics Event Tap)
// =============================================================================

#[cfg(target_os = "macos")]
mod mac_keyboard {
    use super::KeyPressEvent;
    use std::cell::RefCell;
    use std::ffi::c_void;
    use std::ptr;
    use std::sync::mpsc;
    use std::thread;
    use tauri::Emitter;

    type CGEventTapProxy = *const c_void;
    type CGEventRef = *const c_void;
    type CFMachPortRef = *const c_void;
    type CFRunLoopSourceRef = *const c_void;
    type CFRunLoopRef = *const c_void;
    type CFStringRef = *const c_void;

    const K_CG_HID_EVENT_TAP: u32 = 0;
    const K_CG_HEAD_INSERT_EVENT_TAP: u32 = 0;
    const K_CG_EVENT_TAP_OPTION_LISTEN_ONLY: u32 = 1;
    const K_CG_EVENT_KEY_DOWN: u64 = 10;
    const K_CG_EVENT_FLAGS_CHANGED: u64 = 12;
    const K_CG_KEYBOARD_EVENT_KEYCODE: u32 = 9;

    const CG_EVENT_MASK: u64 = (1 << K_CG_EVENT_KEY_DOWN) | (1 << K_CG_EVENT_FLAGS_CHANGED);

    const K_CG_EVENT_FLAG_MASK_SHIFT: u64 = 0x00020000;
    const K_CG_EVENT_FLAG_MASK_CONTROL: u64 = 0x00040000;
    const K_CG_EVENT_FLAG_MASK_ALTERNATE: u64 = 0x00080000;
    const K_CG_EVENT_FLAG_MASK_COMMAND: u64 = 0x00100000;
    const K_CG_EVENT_FLAG_MASK_FN: u64 = 0x00800000;

    extern "C" {
        fn CGEventTapCreate(
            tap: u32,
            place: u32,
            options: u32,
            events_of_interest: u64,
            callback: extern "C" fn(CGEventTapProxy, u32, CGEventRef, *mut c_void) -> CGEventRef,
            user_info: *mut c_void,
        ) -> CFMachPortRef;

        fn CFMachPortCreateRunLoopSource(
            allocator: *const c_void,
            port: CFMachPortRef,
            order: i64,
        ) -> CFRunLoopSourceRef;

        fn CFRunLoopGetCurrent() -> CFRunLoopRef;
        fn CFRunLoopAddSource(rl: CFRunLoopRef, source: CFRunLoopSourceRef, mode: CFStringRef);
        fn CFRunLoopRun();
        fn CGEventGetIntegerValueField(event: CGEventRef, field: u32) -> i64;
        fn CGEventGetFlags(event: CGEventRef) -> u64;
        fn CGEventTapEnable(tap: CFMachPortRef, enable: bool);

        static kCFRunLoopCommonModes: CFStringRef;
    }

    /// Map macOS virtual keycodes to key name strings.
    fn virtual_keycode_to_string(keycode: u16) -> Option<String> {
        match keycode {
            0 => Some("KeyA".into()),
            1 => Some("KeyS".into()),
            2 => Some("KeyD".into()),
            3 => Some("KeyF".into()),
            4 => Some("KeyH".into()),
            5 => Some("KeyG".into()),
            6 => Some("KeyZ".into()),
            7 => Some("KeyX".into()),
            8 => Some("KeyC".into()),
            9 => Some("KeyV".into()),
            11 => Some("KeyB".into()),
            12 => Some("KeyQ".into()),
            13 => Some("KeyW".into()),
            14 => Some("KeyE".into()),
            15 => Some("KeyR".into()),
            16 => Some("KeyY".into()),
            17 => Some("KeyT".into()),
            18 => Some("Num1".into()),
            19 => Some("Num2".into()),
            20 => Some("Num3".into()),
            21 => Some("Num4".into()),
            22 => Some("Num6".into()),
            23 => Some("Num5".into()),
            24 => Some("Equal".into()),
            25 => Some("Num9".into()),
            26 => Some("Num7".into()),
            27 => Some("Minus".into()),
            28 => Some("Num8".into()),
            29 => Some("Num0".into()),
            30 => Some("RightBracket".into()),
            31 => Some("KeyO".into()),
            32 => Some("KeyU".into()),
            33 => Some("LeftBracket".into()),
            34 => Some("KeyI".into()),
            35 => Some("KeyP".into()),
            36 => Some("Return".into()),
            37 => Some("KeyL".into()),
            38 => Some("KeyJ".into()),
            39 => Some("Quote".into()),
            40 => Some("KeyK".into()),
            41 => Some("SemiColon".into()),
            42 => Some("BackSlash".into()),
            43 => Some("Comma".into()),
            44 => Some("Slash".into()),
            45 => Some("KeyN".into()),
            46 => Some("KeyM".into()),
            47 => Some("Dot".into()),
            48 => Some("Tab".into()),
            50 => Some("BackQuote".into()),
            51 => Some("Delete".into()),
            53 => Some("Escape".into()),
            49 => Some("Space".into()),
            54 => Some("MetaRight".into()),
            55 => Some("MetaLeft".into()),
            56 => Some("ShiftLeft".into()),
            58 => Some("AltLeft".into()),
            59 => Some("ControlLeft".into()),
            60 => Some("ShiftRight".into()),
            61 => Some("AltRight".into()),
            63 => Some("Function".into()),
            _ => None,
        }
    }

    fn is_modifier_press(keycode: u16, flags: u64) -> bool {
        match keycode {
            56 | 60 => flags & K_CG_EVENT_FLAG_MASK_SHIFT != 0,
            58 | 61 => flags & K_CG_EVENT_FLAG_MASK_ALTERNATE != 0,
            55 | 54 => flags & K_CG_EVENT_FLAG_MASK_COMMAND != 0,
            59 => flags & K_CG_EVENT_FLAG_MASK_CONTROL != 0,
            63 => flags & K_CG_EVENT_FLAG_MASK_FN != 0,
            _ => false,
        }
    }

    struct TapContext {
        tx: mpsc::Sender<String>,
        tap: RefCell<CFMachPortRef>,
    }

    extern "C" fn event_tap_callback(
        _proxy: CGEventTapProxy,
        event_type: u32,
        event: CGEventRef,
        user_info: *mut c_void,
    ) -> CGEventRef {
        let ctx = unsafe { &*(user_info as *const TapContext) };

        // Re-enable tap if it was disabled by timeout
        if event_type == 0xFFFFFFFE {
            let tap = *ctx.tap.borrow();
            if !tap.is_null() {
                unsafe { CGEventTapEnable(tap, true) };
            }
            return event;
        }

        let keycode =
            unsafe { CGEventGetIntegerValueField(event, K_CG_KEYBOARD_EVENT_KEYCODE) } as u16;

        if event_type == K_CG_EVENT_FLAGS_CHANGED as u32 {
            let flags = unsafe { CGEventGetFlags(event) };
            if !is_modifier_press(keycode, flags) {
                return event;
            }
        }

        if let Some(key_name) = virtual_keycode_to_string(keycode) {
            let _ = ctx.tx.send(key_name);
        }

        event
    }

    pub fn start(app_handle: tauri::AppHandle) {
        let (tx, rx) = mpsc::channel::<String>();

        let handle = app_handle.clone();
        thread::spawn(move || {
            for key_name in rx {
                let _ = handle.emit("key-press", KeyPressEvent { key_code: key_name });
            }
        });

        thread::spawn(move || {
            let ctx: &'static TapContext = Box::leak(Box::new(TapContext {
                tx,
                tap: RefCell::new(ptr::null()),
            }));
            let ctx_ptr = ctx as *const TapContext as *mut c_void;

            unsafe {
                let tap = CGEventTapCreate(
                    K_CG_HID_EVENT_TAP,
                    K_CG_HEAD_INSERT_EVENT_TAP,
                    K_CG_EVENT_TAP_OPTION_LISTEN_ONLY,
                    CG_EVENT_MASK,
                    event_tap_callback,
                    ctx_ptr,
                );

                if tap.is_null() {
                    eprintln!("Failed to create event tap. Grant Accessibility permission in System Settings.");
                    return;
                }

                *ctx.tap.borrow_mut() = tap;

                let source = CFMachPortCreateRunLoopSource(ptr::null(), tap, 0);
                let run_loop = CFRunLoopGetCurrent();
                CFRunLoopAddSource(run_loop, source, kCFRunLoopCommonModes);
                CFRunLoopRun();
            }
        });
    }
}

// =============================================================================
// Windows keyboard listener (Low-level keyboard hook)
// =============================================================================

#[cfg(target_os = "windows")]
mod win_keyboard {
    use super::KeyPressEvent;
    use std::ffi::c_void;
    use std::ptr;
    use std::sync::mpsc;
    use std::sync::OnceLock;
    use std::thread;
    use tauri::Emitter;

    type HHOOK = *mut c_void;
    type HINSTANCE = *mut c_void;
    type HWND = *mut c_void;
    type WPARAM = usize;
    type LPARAM = isize;
    type LRESULT = isize;

    const WH_KEYBOARD_LL: i32 = 13;
    const WM_KEYDOWN: usize = 0x0100;
    const WM_SYSKEYDOWN: usize = 0x0104;

    #[repr(C)]
    struct KBDLLHOOKSTRUCT {
        vk_code: u32,
        scan_code: u32,
        flags: u32,
        time: u32,
        dw_extra_info: usize,
    }

    #[repr(C)]
    struct POINT {
        x: i32,
        y: i32,
    }

    #[repr(C)]
    struct MSG {
        hwnd: HWND,
        message: u32,
        w_param: WPARAM,
        l_param: LPARAM,
        time: u32,
        pt: POINT,
    }

    extern "system" {
        fn SetWindowsHookExW(
            id_hook: i32,
            lpfn: unsafe extern "system" fn(i32, WPARAM, LPARAM) -> LRESULT,
            hmod: HINSTANCE,
            dw_thread_id: u32,
        ) -> HHOOK;
        fn CallNextHookEx(
            hhk: HHOOK,
            n_code: i32,
            w_param: WPARAM,
            l_param: LPARAM,
        ) -> LRESULT;
        fn GetMessageW(
            lp_msg: *mut MSG,
            h_wnd: HWND,
            msg_filter_min: u32,
            msg_filter_max: u32,
        ) -> i32;
        fn GetModuleHandleW(lp_module_name: *const u16) -> HINSTANCE;
    }

    static KEY_SENDER: OnceLock<mpsc::Sender<String>> = OnceLock::new();

    /// Map Windows virtual key codes to key name strings.
    fn vk_to_key_name(vk: u32) -> Option<String> {
        match vk {
            0x41..=0x5A => Some(format!("Key{}", (vk as u8) as char)),
            0x30..=0x39 => Some(format!("Num{}", vk - 0x30)),
            0x20 => Some("Space".into()),
            0x0D => Some("Return".into()),
            0x08 => Some("Delete".into()),
            0x09 => Some("Tab".into()),
            0x1B => Some("Escape".into()),
            0x14 => Some("CapsLock".into()),
            0xA0 => Some("ShiftLeft".into()),
            0xA1 => Some("ShiftRight".into()),
            0xA2 => Some("ControlLeft".into()),
            0xA3 => Some("ControlRight".into()),
            0xA4 => Some("AltLeft".into()),
            0xA5 => Some("AltRight".into()),
            0x5B => Some("MetaLeft".into()),
            0x5C => Some("MetaRight".into()),
            0xBD => Some("Minus".into()),
            0xBB => Some("Equal".into()),
            0xDB => Some("LeftBracket".into()),
            0xDD => Some("RightBracket".into()),
            0xDC => Some("BackSlash".into()),
            0xBA => Some("SemiColon".into()),
            0xDE => Some("Quote".into()),
            0xC0 => Some("BackQuote".into()),
            0xBC => Some("Comma".into()),
            0xBE => Some("Dot".into()),
            0xBF => Some("Slash".into()),
            _ => None,
        }
    }

    unsafe extern "system" fn keyboard_proc(
        n_code: i32,
        w_param: WPARAM,
        l_param: LPARAM,
    ) -> LRESULT {
        if n_code >= 0 && (w_param == WM_KEYDOWN || w_param == WM_SYSKEYDOWN) {
            let kb = unsafe { &*(l_param as *const KBDLLHOOKSTRUCT) };
            if let Some(key_name) = vk_to_key_name(kb.vk_code) {
                if let Some(tx) = KEY_SENDER.get() {
                    let _ = tx.send(key_name);
                }
            }
        }
        unsafe { CallNextHookEx(ptr::null_mut(), n_code, w_param, l_param) }
    }

    pub fn start(app_handle: tauri::AppHandle) {
        let (tx, rx) = mpsc::channel::<String>();
        let _ = KEY_SENDER.set(tx);

        let handle = app_handle.clone();
        thread::spawn(move || {
            for key_name in rx {
                let _ = handle.emit("key-press", KeyPressEvent { key_code: key_name });
            }
        });

        thread::spawn(move || unsafe {
            let hmod = GetModuleHandleW(ptr::null());
            let hook = SetWindowsHookExW(WH_KEYBOARD_LL, keyboard_proc, hmod, 0);
            if hook.is_null() {
                eprintln!("Failed to install keyboard hook");
                return;
            }

            // Message pump — required for low-level hooks to receive events
            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, ptr::null_mut(), 0, 0) > 0 {}
        });
    }
}

// =============================================================================
// Accessibility permission check (macOS)
// =============================================================================

#[cfg(target_os = "macos")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
}

#[tauri::command]
fn check_accessibility() -> bool {
    #[cfg(target_os = "macos")]
    {
        unsafe { AXIsProcessTrusted() }
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

#[tauri::command]
fn request_accessibility() {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .spawn();
    }
}

#[tauri::command]
fn start_listener(app: tauri::AppHandle) {
    let started = app.state::<ListenerStarted>();
    if !started.0.swap(true, Ordering::SeqCst) {
        start_keyboard_listener(app);
    }
}

#[tauri::command]
fn set_toggle_shortcut(app: tauri::AppHandle, shortcut: String) {
    let gs = app.global_shortcut();
    // Unregister old custom shortcut
    {
        let old = app.state::<CustomToggleShortcut>();
        let mut old_lock = old.0.lock().unwrap();
        if let Some(ref old_str) = *old_lock {
            if let Ok(s) = parse_shortcut_str(old_str) {
                let _ = gs.unregister(s);
            }
        }
        *old_lock = if shortcut.is_empty() { None } else { Some(shortcut.clone()) };
    }

    if shortcut.is_empty() {
        return;
    }

    // Register new shortcut — it will be handled by the global with_handler
    if let Ok(s) = parse_shortcut_str(&shortcut) {
        let _ = gs.register(s);
    }
}

struct CustomToggleShortcut(Mutex<Option<String>>);

fn parse_shortcut_str(s: &str) -> Result<Shortcut, String> {
    let parts: Vec<&str> = s.split('+').collect();
    let mut mods = Modifiers::empty();
    let mut code: Option<Code> = None;

    for part in &parts {
        match part.trim() {
            "Ctrl" => mods |= Modifiers::CONTROL,
            "Alt" => mods |= Modifiers::ALT,
            "Shift" => mods |= Modifiers::SHIFT,
            "Super" => mods |= Modifiers::SUPER,
            key => {
                code = match key {
                    "A" => Some(Code::KeyA), "B" => Some(Code::KeyB), "C" => Some(Code::KeyC),
                    "D" => Some(Code::KeyD), "E" => Some(Code::KeyE), "F" => Some(Code::KeyF),
                    "G" => Some(Code::KeyG), "H" => Some(Code::KeyH), "I" => Some(Code::KeyI),
                    "J" => Some(Code::KeyJ), "K" => Some(Code::KeyK), "L" => Some(Code::KeyL),
                    "M" => Some(Code::KeyM), "N" => Some(Code::KeyN), "O" => Some(Code::KeyO),
                    "P" => Some(Code::KeyP), "Q" => Some(Code::KeyQ), "R" => Some(Code::KeyR),
                    "S" => Some(Code::KeyS), "T" => Some(Code::KeyT), "U" => Some(Code::KeyU),
                    "V" => Some(Code::KeyV), "W" => Some(Code::KeyW), "X" => Some(Code::KeyX),
                    "Y" => Some(Code::KeyY), "Z" => Some(Code::KeyZ),
                    "0" => Some(Code::Digit0), "1" => Some(Code::Digit1), "2" => Some(Code::Digit2),
                    "3" => Some(Code::Digit3), "4" => Some(Code::Digit4), "5" => Some(Code::Digit5),
                    "6" => Some(Code::Digit6), "7" => Some(Code::Digit7), "8" => Some(Code::Digit8),
                    "9" => Some(Code::Digit9),
                    "F1" => Some(Code::F1), "F2" => Some(Code::F2), "F3" => Some(Code::F3),
                    "F4" => Some(Code::F4), "F5" => Some(Code::F5), "F6" => Some(Code::F6),
                    "F7" => Some(Code::F7), "F8" => Some(Code::F8), "F9" => Some(Code::F9),
                    "F10" => Some(Code::F10), "F11" => Some(Code::F11), "F12" => Some(Code::F12),
                    " " | "Space" => Some(Code::Space),
                    "Enter" => Some(Code::Enter),
                    "Escape" => Some(Code::Escape),
                    "Tab" => Some(Code::Tab),
                    _ => None,
                };
            }
        }
    }

    match code {
        Some(c) => Ok(Shortcut::new(if mods.is_empty() { None } else { Some(mods) }, c)),
        None => Err("Invalid key".to_string()),
    }
}

// =============================================================================

fn start_keyboard_listener(app_handle: tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    mac_keyboard::start(app_handle);

    #[cfg(target_os = "windows")]
    win_keyboard::start(app_handle);
}

// --- Window / Tray / Shortcut ---

fn toggle_window(app: &tauri::AppHandle) {
    let state = app.state::<WindowVisible>();
    let was_visible = state.0.fetch_xor(true, Ordering::SeqCst);
    if let Some(window) = app.get_webview_window("main") {
        if was_visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

fn update_tray_menu_labels(app: &tauri::AppHandle) {
    let visible = app.state::<WindowVisible>().0.load(Ordering::SeqCst);
    let pinned = app.state::<WindowPinned>().0.load(Ordering::SeqCst);
    let view_idx = app.state::<ViewModeState>().0.load(Ordering::Relaxed);
    let persp_idx = app.state::<PerspectiveIdx>().0.load(Ordering::Relaxed);
    let lang = *app.state::<TrayLang>().0.lock().unwrap();
    let labels = get_labels(lang);
    let items = app.state::<TrayMenuItems>();
    let _ = items.show.set_text(if visible { labels.show_visible } else { labels.show_hidden });
    let _ = items.pin.set_text(if pinned { labels.pin_on } else { labels.pin_off });

    // View mode with checkmark
    let view_text = format!("{} {} / {} / {}",
        if lang == Lang::Zh { "视图:" } else { "View:" },
        if view_idx == 0 { format!("✓{}", labels.view_farm) } else { labels.view_farm.to_string() },
        if view_idx == 1 { format!("✓{}", labels.view_flat) } else { labels.view_flat.to_string() },
        if view_idx == 2 { format!("✓{}", labels.view_heatmap) } else { labels.view_heatmap.to_string() },
    );
    let _ = items.heatmap.set_text(&view_text);

    // Perspective with checkmark
    let persp_text = format!("{} {} / {}",
        if lang == Lang::Zh { "视角:" } else { "Angle:" },
        if persp_idx == 0 { format!("✓{}", labels.persp_left) } else { labels.persp_left.to_string() },
        if persp_idx == 1 { format!("✓{}", labels.persp_right) } else { labels.persp_right.to_string() },
    );
    let _ = items.perspective.set_text(&persp_text);

    let _ = items.settings.set_text(labels.settings);
    let _ = items.stats.set_text(labels.stats);
    let _ = items.quit.set_text(labels.quit);
    let _ = items.lang.set_text(labels.lang_switch);
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let lang = *app.state::<TrayLang>().0.lock().unwrap();
    let labels = get_labels(lang);

    let show = MenuItem::with_id(app, "show", labels.show_visible, true, None::<&str>)?;
    let pin = MenuItem::with_id(app, "pin", labels.pin_on, true, None::<&str>)?;
    let heatmap = MenuItem::with_id(app, "heatmap", "View", true, None::<&str>)?;
    let perspective = MenuItem::with_id(app, "perspective", "Angle", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", labels.settings, true, None::<&str>)?;
    let stats = MenuItem::with_id(app, "stats", labels.stats, true, None::<&str>)?;
    let lang_item = MenuItem::with_id(app, "lang", labels.lang_switch, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", labels.quit, true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &pin, &heatmap, &perspective, &settings, &stats, &lang_item, &quit])?;

    app.manage(TrayMenuItems {
        show: show.clone(),
        pin: pin.clone(),
        heatmap: heatmap.clone(),
        perspective: perspective.clone(),
        settings: settings.clone(),
        stats: stats.clone(),
        quit: quit.clone(),
        lang: lang_item.clone(),
    });
    app.manage(ViewModeState(std::sync::atomic::AtomicU8::new(0)));   // 0=farm
    app.manage(PerspectiveIdx(std::sync::atomic::AtomicU8::new(0)));  // 0=left

    TrayIconBuilder::new()
        .icon(tauri::include_image!("icons/tray-icon.png"))
        .menu(&menu)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    toggle_window(app);
                    update_tray_menu_labels(app);
                }
                "pin" => {
                    let pinned = app.state::<WindowPinned>();
                    let was_pinned = pinned.0.fetch_xor(true, Ordering::SeqCst);
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.set_always_on_top(!was_pinned);
                    }
                    update_tray_menu_labels(app);
                }
                "heatmap" => {
                    let state = app.state::<ViewModeState>();
                    let cur = state.0.load(Ordering::Relaxed);
                    let next = (cur + 1) % 3; // farm(0) → flat(1) → heatmap(2)
                    state.0.store(next, Ordering::Relaxed);
                    let _ = app.emit("toggle-heatmap", ());
                    update_tray_menu_labels(app);
                }
                "perspective" => {
                    let state = app.state::<PerspectiveIdx>();
                    let cur = state.0.load(Ordering::Relaxed);
                    let next = (cur + 1) % 2; // left(0) → right(1)
                    state.0.store(next, Ordering::Relaxed);
                    let _ = app.emit("toggle-perspective", ());
                    update_tray_menu_labels(app);
                }
                "stats" => {
                    let visible = app.state::<WindowVisible>();
                    if !visible.0.load(Ordering::SeqCst) {
                        visible.0.store(true, Ordering::SeqCst);
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    let _ = app.emit("toggle-stats", ());
                    update_tray_menu_labels(app);
                }
                "settings" => {
                    let visible = app.state::<WindowVisible>();
                    if !visible.0.load(Ordering::SeqCst) {
                        visible.0.store(true, Ordering::SeqCst);
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    let _ = app.emit("open-settings", ());
                    update_tray_menu_labels(app);
                }
                "lang" => {
                    {
                        let tray_lang = app.state::<TrayLang>();
                        let mut current = tray_lang.0.lock().unwrap();
                        *current = match *current {
                            Lang::Zh => Lang::En,
                            Lang::En => Lang::Zh,
                        };
                    }
                    // Persist language to store
                    let lang = *app.state::<TrayLang>().0.lock().unwrap();
                    let lang_str = match lang {
                        Lang::Zh => "zh",
                        Lang::En => "en",
                    };
                    // Emit to frontend so it can sync
                    let _ = app.emit("set-language", lang_str);
                    // Save to store file
                    save_lang_to_store(app, lang_str);
                    update_tray_menu_labels(app);
                }
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_window(tray.app_handle());
                update_tray_menu_labels(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn save_lang_to_store(app: &tauri::AppHandle, lang_str: &str) {
    // Write language to the store.json file used by the frontend
    if let Ok(app_dir) = app.path().app_data_dir() {
        let store_path = app_dir.join("store.json");
        let mut data: serde_json::Map<String, serde_json::Value> = if let Ok(content) = std::fs::read_to_string(&store_path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            serde_json::Map::new()
        };
        data.insert("language".to_string(), serde_json::Value::String(lang_str.to_string()));
        if let Ok(json) = serde_json::to_string_pretty(&data) {
            let _ = std::fs::write(&store_path, json);
        }
    }
}

fn load_lang_from_store(app: &tauri::App) -> Lang {
    if let Ok(app_dir) = app.path().app_data_dir() {
        let store_path = app_dir.join("store.json");
        if let Ok(content) = std::fs::read_to_string(&store_path) {
            if let Ok(data) = serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&content) {
                if let Some(serde_json::Value::String(lang_str)) = data.get("language") {
                    return match lang_str.as_str() {
                        "en" => Lang::En,
                        _ => Lang::Zh,
                    };
                }
            }
        }
    }
    Lang::Zh // default to Chinese
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        toggle_window(app);
                        update_tray_menu_labels(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            check_accessibility,
            request_accessibility,
            start_listener,
            set_toggle_shortcut,
        ])
        .setup(|app| {
            app.manage(ListenerStarted(AtomicBool::new(false)));
            app.manage(WindowVisible(AtomicBool::new(true)));
            app.manage(WindowPinned(AtomicBool::new(true)));
            app.manage(CustomToggleShortcut(Mutex::new(None)));

            // Load language preference from store (defaults to Chinese)
            let lang = load_lang_from_store(app);
            app.manage(TrayLang(Mutex::new(lang)));

            setup_tray(app)?;
            update_tray_menu_labels(app.handle());

            // Load and register saved toggle window shortcut
            if let Ok(app_dir) = app.path().app_data_dir() {
                let store_path = app_dir.join("store.json");
                if let Ok(content) = std::fs::read_to_string(&store_path) {
                    if let Ok(data) = serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&content) {
                        if let Some(serde_json::Value::Array(keys)) = data.get("shortcut_toggle_window") {
                            let parts: Vec<String> = keys.iter()
                                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                .collect();
                            if !parts.is_empty() {
                                let shortcut_str = parts.join("+");
                                if let Ok(s) = parse_shortcut_str(&shortcut_str) {
                                    let _ = app.global_shortcut().register(s);
                                    let custom = app.state::<CustomToggleShortcut>();
                                    *custom.0.lock().unwrap() = Some(shortcut_str);
                                }
                            }
                        }
                    }
                }
            }

            // Workaround: transparent windows can disappear when dragged to a
            // display with a different backing scale factor (macOS WebKit bug).
            // A debounced 1px resize after move forces a redraw.
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                let w = window.clone();
                let pending = Arc::new(AtomicBool::new(false));
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Moved(_) = event {
                        if !pending.swap(true, Ordering::SeqCst) {
                            let w = w.clone();
                            let pending = pending.clone();
                            std::thread::spawn(move || {
                                std::thread::sleep(std::time::Duration::from_millis(150));
                                if let Ok(size) = w.outer_size() {
                                    let _ = w.set_size(tauri::PhysicalSize::new(
                                        size.width + 1,
                                        size.height,
                                    ));
                                    let _ = w.set_size(size);
                                }
                                pending.store(false, Ordering::SeqCst);
                            });
                        }
                    }
                });
            }

            let shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyK);
            app.global_shortcut().register(shortcut)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
