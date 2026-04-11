from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import ServiceContainer, router
from app.core.config import EnvironmentSettings, get_environment_settings
from app.services.audio.transcription_service import AudioTranscriptionService
from app.services.conversation_db import init_db
from app.services.conversation_service import ConversationService
from app.services.document_service import DocumentService
from app.services.embeddings.service import EmbeddingService
from app.services.enrichment_service import EnrichmentService
from app.services.ingestion.extractors import TextExtractionService
from app.services.ingestion.pipeline import IngestionPipeline
from app.services.llm.chat_service import ChatService
from app.services.ocr.tesseract_service import TesseractOCRService
from app.services.retrieval_service import RetrievalService
from app.services.settings_service import SettingsService
from app.services.vectorstore.chroma_store import ChromaVectorStore


def build_container(env: EnvironmentSettings) -> ServiceContainer:
    settings_service = SettingsService(env)
    document_service = DocumentService(env)
    vector_store = ChromaVectorStore(env)
    embedding_service = EmbeddingService(env)
    retrieval_service = RetrievalService(
        embedding_service=embedding_service,
        vector_store=vector_store,
    )
    enrichment_service = EnrichmentService(env, settings_service=settings_service)
    text_extractor = TextExtractionService(
        ocr_service=TesseractOCRService(),
        audio_service=AudioTranscriptionService(model_name=env.default_whisper_model),
    )
    ingestion_pipeline = IngestionPipeline(
        env=env,
        document_service=document_service,
        extractor=text_extractor,
        embeddings=embedding_service,
        enrichment_service=enrichment_service,
        vector_store=vector_store,
    )
    chat_service = ChatService(env=env, retrieval_service=retrieval_service)
    conversation_service = ConversationService(db_path=env.data_root / "conversations.db")

    return ServiceContainer(
        settings=settings_service,
        documents=document_service,
        ingestion=ingestion_pipeline,
        chat=chat_service,
        conversations=conversation_service,
        vector_store=vector_store,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    env = get_environment_settings()
    env.data_root.mkdir(parents=True, exist_ok=True)
    env.uploads_dir.mkdir(parents=True, exist_ok=True)
    env.processed_dir.mkdir(parents=True, exist_ok=True)
    env.chroma_dir.mkdir(parents=True, exist_ok=True)

    db_path = env.data_root / "conversations.db"
    await init_db(db_path)

    app.state.env = env
    app.state.container = build_container(env)
    yield


app = FastAPI(title="Local-First RAG MVP", lifespan=lifespan)
env = get_environment_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=env.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}

