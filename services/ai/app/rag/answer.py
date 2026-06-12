"""Answer pipeline — docs/04 §6-এর flowchart কোডে (S0-08).

পথ: retrieve (agent-scoped) → threshold gate → prompt assembly → LLM →
groundedness check → answer+citation | UNKNOWN।
"""

from pydantic import BaseModel

from app.gateway import llm_gateway
from app.rag.vector_store import PgVectorStore

RETRIEVAL_THRESHOLD = 0.35  # TODO(S0-10): eval suite দিয়ে tune; পরে per-agent config

vector_store = PgVectorStore()


class AnswerRequest(BaseModel):
    org_id: str
    agent_id: str
    question: str
    profile: llm_gateway.ModelProfile = "economy"
    # TODO(S0-08): conversation history (সাম্প্রতিক N turn — cacheable, docs/10 §1)


class Citation(BaseModel):
    source_name: str
    page: int | None


class AnswerResponse(BaseModel):
    kind: str  # "answer" | "unknown"
    text: str
    citations: list[Citation] = []


# স্থির prefix — cache_control এর আওতায় (docs/10 §1); পরিবর্তনশীল কিছু এখানে নয়!
# TODO(S0-08): persona_config থেকে tone/language যোগ — সেগুলোও per-agent স্থির, prefix-এ থাকবে
SYSTEM_PROMPT = """\
You are a customer support agent. Answer ONLY from the provided context.
If the context does not contain the answer, reply exactly: UNKNOWN
Match the user's language (Bangla / English / Banglish). Be concise and polite.
"""


async def answer(req: AnswerRequest) -> AnswerResponse:
    # 1. Retrieve — সবসময় org+agent scoped (docs/03 §6.2)
    query_vec = (await llm_gateway.embed([req.question]))[0]
    hits = await vector_store.search(
        org_id=req.org_id, agent_id=req.agent_id, query_vector=query_vec, k=5
    )

    # 2. Threshold gate — দুর্বল retrieval = সরাসরি UNKNOWN, LLM-কে বানাতে দেওয়া নয়
    hits = [h for h in hits if h.score >= RETRIEVAL_THRESHOLD]
    if not hits:
        return AnswerResponse(kind="unknown", text="")

    # 3. Generate — context untrusted delimiter-এ (prompt injection — docs/03 §6.1)
    context = "\n\n".join(
        f"<chunk source=\"{h.source_name}\" page=\"{h.page}\">\n{h.content}\n</chunk>"
        for h in hits
    )
    completion = await llm_gateway.complete(
        profile=req.profile,
        system=SYSTEM_PROMPT,
        user_content=f"<context>\n{context}\n</context>\n\nQuestion: {req.question}",
    )

    # 4. UNKNOWN detection (model self-report) — groundedness verifier পরের sprint (docs/04 §6)
    if completion.text.strip() == "UNKNOWN":
        return AnswerResponse(kind="unknown", text="")

    return AnswerResponse(
        kind="answer",
        text=completion.text,
        citations=[Citation(source_name=h.source_name, page=h.page) for h in hits[:3]],
    )
    # TODO(S0-09): completion.usage → usage_ledger
