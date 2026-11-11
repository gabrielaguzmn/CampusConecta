from django.urls import path

from .views import SemanticHealthView, SemanticMatchView

urlpatterns = [
    path("semantic-match/", SemanticMatchView.as_view(), name="semantic-match"),
    path("semantic-health/", SemanticHealthView.as_view(), name="semantic-health"),
]
