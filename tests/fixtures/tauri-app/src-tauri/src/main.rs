use serde::Serialize;

#[derive(Serialize)]
struct Note {
    id: String,
    title: String,
}

#[tauri::command]
fn list_notes() -> Result<Vec<Note>, String> {
    Ok(vec![])
}

#[tauri::command]
fn create_note(title: String) -> Result<Note, String> {
    Ok(Note { id: "1".into(), title })
}

#[tauri::command]
async fn delete_note(id: String) -> Result<(), String> {
    let _ = id;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_notes, create_note, delete_note])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
