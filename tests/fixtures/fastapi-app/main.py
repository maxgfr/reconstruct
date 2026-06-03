from fastapi import FastAPI
from routers.items import router as items_router

app = FastAPI()

app.include_router(items_router, prefix="/api")


@app.get("/health")
def health():
    return {"ok": True}
