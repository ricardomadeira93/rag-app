from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import ServiceContainer, router
from app.api.sources import router as sources_router
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
from app.services.memory_db import init_memory_db
from app.services.chunking_db import init_chunking_db
from app.services.memory_service import MemoryService
from app.services.graph_db import init_graph_db, GraphDBService
from app.services.ocr.tesseract_service import TesseractOCRService
from app.services.retrieval_service import RetrievalService
from app.services.settings_service import SettingsService
from app.services.vectorstore.base import VectorStore
from app.services.vectorstore.router import get_vector_store
from app.services.vectorstore.bm25_store import BM25Store
from app.services.vectorstore.cross_encoder import CrossEncoderService
from app.services.workspace_service import WorkspaceService


def build_container(env: EnvironmentSettings, bm25_store: BM25Store | None = None, cross_encoder: CrossEncoderService | None = None) -> ServiceContainer:
    conversation_db_path = env.data_root / "conversations.db"
    workspace_service = WorkspaceService(db_path=conversation_db_path, env=env)
    settings_service = SettingsService(env, workspace_service=workspace_service)
    document_service = DocumentService(env, workspace_service=workspace_service)
    vector_store = get_vector_store(env)
    bm25 = bm25_store or BM25Store(vector_store) # fallback
    memory_service = MemoryService(
        db_path=conversation_db_path,
        conversation_db_path=conversation_db_path,
        env=env,
    )
    embedding_service = EmbeddingService(env)
    retrieval_service = RetrievalService(
        embedding_service=embedding_service,
        vector_store=vector_store,
        bm25_store=bm25,
        cross_encoder=cross_encoder,
        chunking_db_path=env.data_root / "chunks.db",
        document_service=document_service,
    )
    enrichment_service = EnrichmentService(env, settings_service=settings_service)
    text_extractor = TextExtractionService(
        ocr_service=TesseractOCRService(),
        audio_service=AudioTranscriptionService(model_name=env.default_whisper_model),
    )
    graph_service = GraphDBService(db_path=env.data_root / "graph.db")
    chat_service = ChatService(
        env=env,
        retrieval_service=retrieval_service,
        memory_service=memory_service,
    )
    ingestion_pipeline = IngestionPipeline(
        env=env,
        document_service=document_service,
        extractor=text_extractor,
        embeddings=embedding_service,
        enrichment_service=enrichment_service,
        vector_store=vector_store,
        bm25_store=bm25,
    )
    conversation_service = ConversationService(db_path=conversation_db_path, workspace_service=workspace_service)

    return ServiceContainer(
        workspaces=workspace_service,
        settings=settings_service,
        documents=document_service,
        ingestion=ingestion_pipeline,
        chat=chat_service,
        conversations=conversation_service,
        vector_store=vector_store,
        memory=memory_service,
        bm25_store=bm25,
        cross_encoder=cross_encoder,
        graph_service=graph_service,
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

    chunking_db_path = env.data_root / "chunks.db"
    await init_chunking_db(chunking_db_path)

    graph_db_path = env.data_root / "graph.db"
    await init_graph_db(graph_db_path)

    await init_memory_db(db_path)

    vector_store = get_vector_store(env)
    bm25 = BM25Store(vector_store)
    bm25.initialize()
    
    # Initialize CrossEncoder component
    cross_encoder = CrossEncoderService()

    app.state.env = env
    app.state.container = build_container(env, bm25_store=bm25, cross_encoder=cross_encoder)
    await app.state.container.workspaces.ensure_default_workspace()
    default_id = app.state.container.workspaces.get_active_workspace_id_sync()
    env.workspace_dir(default_id).mkdir(parents=True, exist_ok=True)
    if env.settings_file.exists() and not env.workspace_settings_file(default_id).exists():
        env.workspace_settings_file(default_id).write_text(env.settings_file.read_text(encoding="utf-8"), encoding="utf-8")
    if env.documents_file.exists() and not env.workspace_documents_file(default_id).exists():
        env.workspace_documents_file(default_id).write_text(env.documents_file.read_text(encoding="utf-8"), encoding="utf-8")
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
app.include_router(sources_router)


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
