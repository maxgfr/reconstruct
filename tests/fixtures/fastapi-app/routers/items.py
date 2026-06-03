from fastapi import APIRouter

router = APIRouter(prefix="/items")


@router.get("/")
def list_items():
    return []


@router.post("/")
def create_item():
    return {"id": 1}


@router.get("/{item_id}")
def get_item(item_id: int):
    return {"id": item_id}
