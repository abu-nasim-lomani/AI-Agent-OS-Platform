"""LLM Gateway — model-agnostic adapter layer (docs/05 §3, review: docs/13 Q5).

নিয়মগুলো এখানে কেন্দ্রীভূত (এর বাইরে provider SDK import নিষেধ — A6 lint rule):
  1. Customer/agent কখনো model নয়, *profile* জানে — মানচিত্র এই module-এর সম্পত্তি।
  2. প্রতিটি call-এর provider-reported usage capture → usage_ledger (docs/12 §5)।
  3. Fallback chain: primary fail → secondary; ভান নয় — fallback metric-এ recorded।
"""

from dataclasses import dataclass
from typing import Literal

import anthropic  # noqa: TID251 — gateway-ই একমাত্র বৈধ import-স্থান

ModelProfile = Literal["economy", "standard", "premium"]

# মানচিত্রের মালিক: কোয়ার্টারলি eval benchmark (docs/11 §4) — হাতে বদলানো নিষেধ,
# benchmark report-এর PR দিয়ে বদলাবে। Plan→profile gate: docs/10 §2।
PROFILE_MODEL_MAP: dict[ModelProfile, str] = {
    "economy": "claude-haiku-4-5",
    "standard": "claude-sonnet-4-6",
    "premium": "claude-opus-4-8",
}


@dataclass
class Usage:
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    cached_tokens: int  # cache hit metric — 0 থাকলে silent invalidator (docs/10 §1)


@dataclass
class Completion:
    text: str
    usage: Usage


_client = anthropic.AsyncAnthropic()  # ANTHROPIC_API_KEY env থেকে


async def complete(
    *,
    profile: ModelProfile,
    system: str,
    user_content: str,
    max_tokens: int = 1024,
) -> Completion:
    """একটি উত্তর তৈরি করে। Caching নিয়ম (docs/10 §1): system = স্থির prefix,
    cache_control-সহ; পরিবর্তনশীল সবকিছু (RAG context, প্রশ্ন) user turn-এ।
    """
    model = PROFILE_MODEL_MAP[profile]
    response = await _client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=[
            {
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_content}],
    )
    text = next((b.text for b in response.content if b.type == "text"), "")
    return Completion(
        text=text,
        usage=Usage(
            provider="anthropic",
            model=model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            cached_tokens=response.usage.cache_read_input_tokens or 0,
        ),
    )
    # TODO(S0-06): usage → Core API usage_ledger POST (kind="llm_reply")
    # TODO(S0-06): fallback chain (primary 5xx/timeout → secondary provider) + metric
    # TODO(পরে): streaming, daily budget kill-switch check (docs/09 F10.3)


async def embed(texts: list[str]) -> list[list[float]]:
    """Embedding (S0-07) — Voyage API; dimension = db/migrations/0001-এর vector(1024)।

    Provider বাছাই Bangla retrieval benchmark-সাপেক্ষে পরিবর্তনযোগ্য (docs/08 §2) —
    কিন্তু model বদল মানে full re-index; version knowledge-version-এ pinned (F4.4)।
    """
    import httpx  # local import — answer path-এ load খরচ নয়

    from app.config import settings

    if not settings.voyage_api_key:
        raise RuntimeError("VOYAGE_API_KEY missing — embeddings unavailable")

    async with httpx.AsyncClient(timeout=60) as http:
        resp = await http.post(
            "https://api.voyageai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {settings.voyage_api_key}"},
            json={
                "model": settings.embedding_model,
                "input": texts,
                "output_dimension": settings.embedding_dim,
            },
        )
        resp.raise_for_status()
        data = resp.json()["data"]
    return [item["embedding"] for item in sorted(data, key=lambda d: d["index"])]
