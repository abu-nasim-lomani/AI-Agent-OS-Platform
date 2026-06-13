"""Settings — env থেকে (pydantic-settings, case-insensitive)। .env.example-এর সাথে sync."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://agentos:agentos_dev@localhost:5432/agentos"
    # runtime — agentos_app (NOBYPASSRLS)। superuser দিয়ে app চালানো নিষেধ (docs/03 §2.2)
    app_database_url: str = "postgresql://agentos_app:agentos_app_dev@localhost:5432/agentos"
    redis_queue_url: str = "redis://localhost:6380"  # queue-Redis — cache নয় (A1)

    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "agentos"
    s3_secret_key: str = "agentos_dev"
    s3_bucket: str = "knowledge"

    # Embeddings — dim ⇔ db/migrations/0001 vector(1024) ⇔ এই দুটি একসাথে বদলায়
    voyage_api_key: str = ""
    embedding_model: str = "voyage-3-large"
    embedding_dim: int = 1024

    anthropic_api_key: str = ""  # SDK নিজেই env থেকে নেয়; এখানে শুধু উপস্থিতি-যাচাইয়ের জন্য


settings = Settings()
