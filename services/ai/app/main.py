"""AgentOS AI Service — FastAPI entrypoint (S0-06).

দায়িত্ব (docs/02 §2): RAG answer, embedding, LLM gateway, ingestion workers.
Stateless — সব state Postgres/Redis/S3-তে।
"""

from fastapi import FastAPI

from app.rag.answer import AnswerRequest, AnswerResponse, answer

app = FastAPI(title="AgentOS AI Service", version="0.0.1")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "agentos-ai"}


@app.post("/v1/answer", response_model=AnswerResponse)
async def post_answer(req: AnswerRequest) -> AnswerResponse:
    """Core API → এখানে। প্রতি কলে: retrieve → generate → usage record (docs/04 §6)।"""
    return await answer(req)
