import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export async function loadNotes() {
  return invoke("list_notes");
}

listen("note-created", (event) => console.log(event.payload));
