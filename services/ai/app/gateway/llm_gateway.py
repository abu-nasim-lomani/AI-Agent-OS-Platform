"""LLM Gateway — model-agnostic adapter layer (docs/05 §3, review: docs/13 Q5).

নিয়মগুলো এখানে কেন্দ্রীভূত (এর বাইরে provider SDK import নিষেধ — A6 lint rule):
  1. Customer/agent কখনো model নয়, *profile* জানে — মানচিত্র এই module-এর সম্পত্তি।
  2. প্রতিটি call-এর provider-reported usage capture → usage_ledger (docs/12 §5)।
  3. Fallback chain: primary fail → secondary; ভান নয় — fallback metric-এ recorded।
"""

from dataclasses import dataclass
from typing import Literal

from app.config import settings

ModelProfile = Literal["economy", "standard", "premium"]

# profile → model মানচিত্র, provider-ভেদে। মালিক: কোয়ার্টারলি eval benchmark
# (docs/11 §4) — হাতে নয়, benchmark PR দিয়ে। Plan→profile gate: docs/10 §2।
PROFILE_MODEL_MAP: dict[str, dict[ModelProfile, str]] = {
    "anthropic": {
        "economy": "claude-haiku-4-5",
        "standard": "claude-sonnet-4-6",
        "premium": "claude-opus-4-8",
    },
    "openai": {
        "economy": "gpt-4o-mini",
        "standard": "gpt-4o",
        "premium": "gpt-4o",
    },
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


async def complete(
    *,
    profile: ModelProfile,
    system: str,
    user_content: str,
    max_tokens: int = 1024,
) -> Completion:
    """একটি উত্তর তৈরি করে। Provider config দিয়ে নির্বাচিত (model-agnostic — docs/05 §3)।
    Caching (docs/10 §1): system = স্থির prefix; পরিবর্তনশীল সব user turn-এ।
    """
    provider = settings.llm_provider
    model = PROFILE_MODEL_MAP[provider][profile]
    if provider == "anthropic":
        return await _complete_anthropic(model, system, user_content, max_tokens)
    if provider == "openai":
        return await _complete_openai(model, system, user_content, max_tokens)
    raise RuntimeError(f"unknown LLM_PROVIDER: {provider}")
    # TODO(S0-09): usage → Core API usage_ledger POST (kind="llm_reply")
    # TODO(S0-06): fallback chain (primary 5xx/timeout → secondary provider) + metric
    # TODO(পরে): streaming, daily budget kill-switch check (docs/09 F10.3)


async def _complete_anthropic(model, system, user_content, max_tokens) -> Completion:
    # gateway-ই একমাত্র বৈধ import-স্থান; lazy (key না থাকলে import crash নয়)
    import anthropic  # noqa: TID251

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    response = await client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
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


async def _complete_openai(model, system, user_content, max_tokens) -> Completion:
    """OpenAI Chat Completions — httpx দিয়ে (SDK dependency নয়, embed()-এর মতোই)।"""
    import httpx

    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY missing")
    async with httpx.AsyncClient(timeout=60) as http:
        resp = await http.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={
                "model": model,
                "max_tokens": max_tokens,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_content},
                ],
            },
        )
        resp.raise_for_status()
        data = resp.json()
    usage = data.get("usage", {})
    cached = usage.get("prompt_tokens_details", {}).get("cached_tokens", 0)
    return Completion(
        text=data["choices"][0]["message"]["content"],
        usage=Usage(
            provider="openai",
            model=model,
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
            cached_tokens=cached,
        ),
    )


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
