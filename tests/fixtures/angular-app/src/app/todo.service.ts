import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../environments/environment";

export interface Todo {
  id: string;
  title: string;
  done: boolean;
}

@Injectable({ providedIn: "root" })
export class TodoService {
  private http = inject(HttpClient);

  list() {
    return this.http.get<Todo[]>(`${environment.apiUrl}/todos`);
  }

  create(title: string) {
    return this.http.post<Todo>(`${environment.apiUrl}/todos`, { title });
  }
}
