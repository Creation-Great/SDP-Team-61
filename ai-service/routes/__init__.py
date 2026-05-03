"""
Route registration — aggregates all Blueprints in one place.

New Blueprints should be added to ``register_all()`` so that ``app.py``
only needs a single call.
"""


def register_all(app):
    """Import and register every Blueprint on *app*."""
    from .health import health_bp
    from .feedback import feedback_bp
    from .rewrite import rewrite_bp
    from .polish import polish_bp
    from .summarize import summarize_bp
    from .scoring import scoring_bp
    from .similarity import similarity_bp
    from .chat import chat_bp
    from .logs import logs_bp
    from .search import search_bp

    for bp in [
        health_bp,
        feedback_bp,
        rewrite_bp,
        polish_bp,
        summarize_bp,
        scoring_bp,
        similarity_bp,
        chat_bp,
        logs_bp,
        search_bp,
    ]:
        app.register_blueprint(bp)
