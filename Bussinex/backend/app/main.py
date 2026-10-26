from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.models.product import Product
from app.routes.product import router as product_router

app = FastAPI(title=settings.APP_NAME)

# Allow the local Vite development server to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
app.include_router(product_router)


@app.get("/")
def root():
    return {"message": f"{settings.APP_NAME} is running"}
